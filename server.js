const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

// Load dữ liệu thật từ Tổng cục Thuế (plain JSON array files)
const outputInvoices = JSON.parse(fs.readFileSync(path.join(__dirname, "mock", "outputInvoice.js"), "utf-8")); // Bán ra
const inputInvoices  = JSON.parse(fs.readFileSync(path.join(__dirname, "mock", "inputInvoice.js"),  "utf-8")); // Mua vào

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// Helper: Map field thật GDT → field chuẩn app
// ============================================================
function mapInvoice(raw, type) {
  // tthai: 1=Hóa đơn mới, 2=Thay thế, 3=Điều chỉnh, 4=Đã bị hủy, 5=Đã bị thay thế, 6=Đã bị điều chỉnh
  const tthai = raw.tthai;
  let invoiceStatus = "Hóa đơn mới";
  let statusBadge = "badge-new";
  if (tthai === 2) { invoiceStatus = "Hóa đơn thay thế"; statusBadge = "badge-replace"; }
  else if (tthai === 3) { invoiceStatus = "Hóa đơn điều chỉnh"; statusBadge = "badge-adjust"; }
  else if (tthai === 4) { invoiceStatus = "Hóa đơn đã bị hủy"; statusBadge = "badge-cancel"; }
  else if (tthai === 5) { invoiceStatus = "Hóa đơn đã bị thay thế"; statusBadge = "badge-replace"; }
  else if (tthai === 6) { invoiceStatus = "Hóa đơn đã bị điều chỉnh"; statusBadge = "badge-adjust"; }

  // ttxly: 1=Chờ, 3=Từ chối, 5=Đã cấp mã, 6=Không mã CQT nhận, 8=Lỗi
  const ttxly = raw.ttxly;
  let cqtStatus = "Đã cấp mã hóa đơn";
  let cqtBadge = "badge-cma";
  if (ttxly === 1) { cqtStatus = "Chờ cấp mã"; cqtBadge = "badge-pending"; }
  else if (ttxly === 3) { cqtStatus = "CQT từ chối"; cqtBadge = "badge-cancel"; }
  else if (ttxly === 6) { cqtStatus = "Không mã - CQT đã nhận"; cqtBadge = "badge-khongma"; }
  else if (ttxly === 8) { cqtStatus = "Lỗi xử lý"; cqtBadge = "badge-cancel"; }

  const sellerName    = raw.nbten || "";
  const sellerTaxCode = raw.nbmst || "";
  const sellerAddress = raw.nbdchi || "";
  const sellerPhone   = raw.nbsdthoai || "";
  const buyerName     = raw.nmten || raw.nmtnmua || "";
  const buyerTaxCode  = raw.nmmst || "";
  const buyerAddress  = raw.nmdchi || "";

  const cqtCode = raw.mhdon || "";
  const cqtDate = raw.ncma ? new Date(raw.ncma).toLocaleString("vi-VN") : "";
  const issueDate = raw.tdlap || raw.nky || "";
  const templateCode = String(raw.khmshdon || "1");
  const subType = raw.ladhddt === 1 ? "hddt" : "mtt";

  let signedDate = raw.nky ? new Date(raw.nky).toLocaleString("vi-VN") : "";
  if (raw.nbcks) {
    try {
      const cks = JSON.parse(raw.nbcks);
      if (cks.SigningTime) signedDate = new Date(cks.SigningTime).toLocaleString("vi-VN");
    } catch (e) {}
  }

  // Items từ chi tiết hàng hóa hoặc tóm tắt thuế suất
  let items = [];
  if (raw.hdhhdvu && Array.isArray(raw.hdhhdvu)) {
    items = raw.hdhhdvu.map((it, i) => ({
      stt: i + 1,
      name: it.ten || it.thhhdvu || "Hàng hóa/dịch vụ",
      unit: it.dvtinh || "",
      quantity: it.sluong || 1,
      price: it.dgia || 0,
      amount: it.thtien || 0,
      vatRate: it.tsuat || "8"
    }));
  } else if (raw.thttltsuat && Array.isArray(raw.thttltsuat)) {
    items = raw.thttltsuat.map((t, i) => ({
      stt: i + 1,
      name: "Hàng hóa/dịch vụ (tổng hợp)",
      unit: "",
      quantity: 1,
      price: t.thtien || 0,
      amount: t.thtien || 0,
      vatRate: t.tsuat || "8%"
    }));
  }

  return {
    id: raw.id,
    type,
    subType,
    templateCode,
    invoiceSeries: raw.khhdon || "",
    invoiceNumber: String(raw.shdon || "").padStart(7, "0"),
    issueDate,
    sellerName,
    sellerTaxCode,
    sellerAddress,
    sellerPhone,
    sellerEmail: raw.nbdctdtu || "",
    buyerName,
    buyerTaxCode,
    buyerAddress,
    paymentMethod: raw.thtttoan || "Chuyển khoản",
    currency: raw.dvtte || "VND",
    exchangeRate: raw.tgia || 1,
    subTotal: raw.tgtcthue || 0,
    vatAmount: raw.tgtthue || 0,
    discountAmount: raw.ttcktmai !== undefined ? raw.ttcktmai : null,
    totalAmount: raw.tgtttbso || 0,
    totalAmountInWords: raw.tgtttbchu || "",
    invoiceStatus,
    statusBadge,
    cqtStatus,
    cqtBadge,
    cqtCode,
    cqtDate,
    cqtCheckDetail: "Hóa đơn hợp lệ",
    relatedInvoice: raw.hdonLquans ? "Có" : "---",
    relatedInfo: "---",
    signedBy: sellerName,
    signedDate,
    items,
    _tthai: tthai,
    _ttxly: ttxly,
    nbmst: raw.nbmst || "",
    nmmst: raw.nmmst || "",
    ttcktmai: raw.ttcktmai !== undefined ? raw.ttcktmai : null
  };
}

// Map toàn bộ dữ liệu thật
const allBanRa  = outputInvoices.map(r => mapInvoice(r, "ban-ra"));
const allMuaVao = inputInvoices.map(r => mapInvoice(r, "mua-vao"));
const allInvoices = [...allBanRa, ...allMuaVao];

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// --- MOCK AUTH APIS ---
app.post("/api/auth/login", (req, res) => {
  const { username } = req.body;
  const mst = username ? username.replace(/-T$/i, "") : "5700496054";
  const user = {
    username: username || "5700496054",
    taxCode: mst,
    companyName: "CÔNG TY TNHH TRÍ LỰC",
    address: "Km4, Móng Cái 3, Quảng Ninh",
    cqtManagement: "Cục Thuế tỉnh Quảng Ninh",
    role: "Quản trị viên doanh nghiệp",
    loginTime: new Date().toISOString()
  };
  return res.json({
    success: true,
    message: "Đăng nhập thành công",
    token: "mock-session-token-" + Date.now(),
    user
  });
});

app.get("/api/auth/profile", (req, res) => {
  return res.json({
    success: true,
    user: {
      username: "5700496054",
      taxCode: "5700496054",
      companyName: "CÔNG TY TNHH TRÍ LỰC",
      address: "Km4, Móng Cái 3, Quảng Ninh",
      cqtManagement: "Cục Thuế tỉnh Quảng Ninh",
      role: "Quản trị viên"
    }
  });
});

app.post("/api/auth/logout", (req, res) => {
  return res.json({ success: true, message: "Đăng xuất thành công" });
});

// --- INVOICE LOOKUP APIS ---
app.get("/api/invoices", (req, res) => {
  const {
    type = "ban-ra",
    subType = "hddt",
    fromDate,
    toDate,
    taxCode,
    invoiceSeries,
    invoiceNumber,
    status,
    checkResult,
    page = 1,
    pageSize = 15
  } = req.query;

  let results = allInvoices.filter(
    inv => inv.type === type && inv.subType === subType
  );

  // Lọc theo khoảng ngày
  if (fromDate) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    results = results.filter(inv => new Date(inv.issueDate) >= from);
  }
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    results = results.filter(inv => new Date(inv.issueDate) <= to);
  }

  // Lọc theo MST đối tác hoặc nbmst / nmmst
  if (taxCode && taxCode.trim()) {
    const cleanTax = taxCode.trim().toLowerCase();
    results = results.filter(inv => {
      const partner = type === "ban-ra" ? inv.buyerTaxCode : inv.sellerTaxCode;
      const ownMst = type === "ban-ra" ? inv.nbmst : inv.nmmst;
      return (ownMst && ownMst.toLowerCase().includes(cleanTax)) ||
             (partner && partner.toLowerCase().includes(cleanTax));
    });
  }

  // Lọc theo ký hiệu hóa đơn
  if (invoiceSeries && invoiceSeries.trim()) {
    results = results.filter(inv =>
      (inv.invoiceSeries || "").toLowerCase().includes(invoiceSeries.trim().toLowerCase())
    );
  }

  // Lọc theo số hóa đơn
  if (invoiceNumber && invoiceNumber.trim()) {
    results = results.filter(inv =>
      (inv.invoiceNumber || "").includes(invoiceNumber.trim())
    );
  }

  // Lọc theo trạng thái hóa đơn (tthai)
  if (status && status !== "ALL") {
    results = results.filter(inv => inv._tthai === parseInt(status, 10));
  }

  // Lọc theo kết quả CQT (ttxly)
  if (checkResult && checkResult !== "ALL") {
    if (checkResult === "capma" || checkResult === "5") results = results.filter(inv => inv._ttxly === 5 || !inv._ttxly);
    else if (checkResult === "mtt") results = results.filter(inv => inv.subType === "mtt");
    else if (checkResult === "khongma" || checkResult === "6") results = results.filter(inv => inv.subType !== "mtt" && inv._ttxly === 6);
    else if (checkResult === "1") results = results.filter(inv => inv._ttxly === 1);
    else if (checkResult === "2") results = results.filter(inv => inv._ttxly === 2);
    else if (checkResult === "3") results = results.filter(inv => inv._ttxly === 3);
    else if (checkResult === "4") results = results.filter(inv => inv._ttxly === 4);
    else if (checkResult === "7") results = results.filter(inv => inv._ttxly === 7 || inv._ttxly === 8);
  }

  const total = results.length;
  const currentPage = parseInt(page, 10) || 1;
  const limit = parseInt(pageSize, 10) || 15;
  const startIndex = (currentPage - 1) * limit;
  const paginatedItems = results.slice(startIndex, startIndex + limit);

  return res.json({
    success: true,
    type,
    subType,
    total,
    page: currentPage,
    pageSize: limit,
    totalPages: Math.ceil(total / limit) || 1,
    data: paginatedItems
  });
});

app.get("/api/invoices/:id", (req, res) => {
  const invoice = allInvoices.find(inv => inv.id === req.params.id);
  if (!invoice) {
    return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn" });
  }
  return res.json({ success: true, data: invoice });
});

// Endpoint xuất XML mô phỏng chuẩn Tổng cục Thuế
app.get("/api/invoices/:id/xml", (req, res) => {
  const invoice = allInvoices.find(inv => inv.id === req.params.id);
  if (!invoice) {
    return res.status(404).send("Invoice not found");
  }

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<HDon xmlns="http://hoadondientu.gdt.gov.vn">
  <DLHDon Id="${invoice.id}">
    <TTChung>
      <PBan>2.0.0</PBan>
      <THDon>${invoice.subType === 'hddt' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG TỪ MÁY TÍNH TIỀN'}</THDon>
      <KHMSHDon>${invoice.templateCode}</KHMSHDon>
      <KHHDon>${invoice.invoiceSeries}</KHHDon>
      <SHDon>${invoice.invoiceNumber}</SHDon>
      <NLap>${invoice.issueDate}</NLap>
      <DVTTe>${invoice.currency}</DVTTe>
      <TGia>${invoice.exchangeRate || 1}</TGia>
      <HTTToan>${invoice.paymentMethod}</HTTToan>
      <MCCQT>${invoice.cqtCode}</MCCQT>
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>${invoice.sellerName}</Ten>
        <MST>${invoice.sellerTaxCode}</MST>
        <DChi>${invoice.sellerAddress}</DChi>
      </NBan>
      <NMua>
        <Ten>${invoice.buyerName}</Ten>
        <MST>${invoice.buyerTaxCode || 'Không mã'}</MST>
        <DChi>${invoice.buyerAddress}</DChi>
      </NMua>
      <DSHHDVu>
        ${invoice.items
          .map(
            (it) => `
        <HHDVu>
          <STT>${it.stt}</STT>
          <THHDVu>${it.name}</THHDVu>
          <DVTinh>${it.unit}</DVTinh>
          <SLuong>${it.quantity}</SLuong>
          <DGia>${it.price}</DGia>
          <Tien>${it.amount}</Tien>
          <TSuat>${it.vatRate}%</TSuat>
        </HHDVu>`
          )
          .join("")}
      </DSHHDVu>
      <TToan>
        <TgTCThue>${invoice.subTotal}</TgTCThue>
        <TgTThue>${invoice.vatAmount}</TgTThue>
        <TgTTTBSo>${invoice.totalAmount}</TgTTTBSo>
        <TgTTTBChu>${invoice.totalAmountInWords}</TgTTTBChu>
      </TToan>
    </NDHDon>
  </DLHDon>
  <DSCKS>
    <NBan>
      <Signature>${invoice.signedBy} - ${invoice.signedDate}</Signature>
    </NBan>
    <CQT>
      <MCCQT>${invoice.cqtCode}</MCCQT>
      <NgayCap>${invoice.cqtDate}</NgayCap>
    </CQT>
  </DSCKS>
</HDon>`;

  res.header("Content-Type", "application/xml");
  res.attachment(`${invoice.invoiceSeries}_${invoice.invoiceNumber}.xml`);
  return res.send(xmlContent);
});

// Endpoint tải file CSV
app.get("/api/export/csv", (req, res) => {
  const { type = "ban-ra", subType = "hddt" } = req.query;
  const invoices = allInvoices.filter(inv => inv.type === type && inv.subType === subType);

  let csv = "\uFEFFSTT,Mẫu số,Ký hiệu,Số HĐ,Ngày lập,MST đối tác,Tên đối tác,Tổng tiền chưa thuế,Tiền thuế,Tổng thanh toán,Trạng thái HĐ,Kết quả CQT\n";
  invoices.forEach((inv, index) => {
    const partnerMST = type === "ban-ra" ? inv.buyerTaxCode : inv.sellerTaxCode;
    const partnerName = `"${(type === "ban-ra" ? inv.buyerName : inv.sellerName).replace(/"/g, '""')}"`;
    const dateStr = inv.issueDate ? new Date(inv.issueDate).toISOString().substring(0, 10) : "";
    csv += `${index + 1},${inv.templateCode},${inv.invoiceSeries},${inv.invoiceNumber},${dateStr},${partnerMST},${partnerName},${inv.subTotal},${inv.vatAmount},${inv.totalAmount},"${inv.invoiceStatus}","${inv.cqtStatus}"\n`;
  });

  res.header("Content-Type", "text/csv; charset=utf-8");
  res.attachment(`danh_sach_hoa_don_${type}_${subType}.csv`);
  return res.send(csv);
});

// Fallback route phục vụ trang chính SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Cổng thông tin Hóa đơn điện tử (Mô phỏng GDT)`);
  console.log(` Server đang chạy tại: http://localhost:${PORT}`);
  console.log(` Dữ liệu: ${allBanRa.length} HĐ bán ra | ${allMuaVao.length} HĐ mua vào`);
  console.log(`====================================================`);
});
