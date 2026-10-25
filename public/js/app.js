// State quản lý của ứng dụng
let currentParentTab = "ban-ra"; // 'ban-ra' (Bán ra) | 'mua-vao' (Mua vào)
let currentSubTab = "hddt";      // 'hddt' (Hóa đơn điện tử) | 'mtt' (Hóa đơn máy tính tiền)
let currentPage = 1;
let pageSize = 15;
let currentInvoices = [];
let selectedInvoice = null;
let selectedInvoiceId = null;

// Khởi tạo người dùng: Mặc định chưa đăng nhập để hiển thị Bước 1: Home chưa login
let currentUser = JSON.parse(localStorage.getItem("gdt_active_user")) || null;

document.addEventListener("DOMContentLoaded", () => {
  initDateFilters();
  initViewByAuth();
});

// Thiết lập chế độ hiển thị theo trạng thái đăng nhập
function initViewByAuth() {
  const guestAuthBox = document.getElementById("auth-guest-box");
  const loggedAuthBox = document.getElementById("auth-logged-box");
  const userBtn = document.getElementById("btn-user-profile");

  const viewGuestHome = document.getElementById("view-guest-home");
  const viewLoggedHome = document.getElementById("view-logged-home");
  const viewLookupInvoice = document.getElementById("view-lookup-invoice");

  if (currentUser) {
    // Đã đăng nhập
    if (guestAuthBox) guestAuthBox.style.display = "none";
    if (loggedAuthBox) loggedAuthBox.style.display = "flex";
    if (userBtn) {
      userBtn.title = `${currentUser.username} - ${currentUser.companyName}`;
    }

    // Hiển thị Trang chủ khi đã login (Bước 3)
    if (viewGuestHome) viewGuestHome.style.display = "none";
    if (viewLoggedHome) viewLoggedHome.style.display = "block";
    if (viewLookupInvoice) viewLookupInvoice.style.display = "none";
  } else {
    // Chưa đăng nhập (Bước 1: Home chưa login)
    if (guestAuthBox) guestAuthBox.style.display = "block";
    if (loggedAuthBox) loggedAuthBox.style.display = "none";

    // Hiển thị Trang chủ khi chưa login
    if (viewGuestHome) viewGuestHome.style.display = "block";
    if (viewLoggedHome) viewLoggedHome.style.display = "none";
    if (viewLookupInvoice) viewLookupInvoice.style.display = "none";
  }
}

// Chuyển về Trang chủ
function navigateHome() {
  document.body.classList.remove("lookup-mode");
  const viewGuestHome = document.getElementById("view-guest-home");
  const viewLoggedHome = document.getElementById("view-logged-home");
  const viewLookupInvoice = document.getElementById("view-lookup-invoice");

  if (viewLookupInvoice) viewLookupInvoice.style.display = "none";

  if (currentUser) {
    if (viewGuestHome) viewGuestHome.style.display = "none";
    if (viewLoggedHome) viewLoggedHome.style.display = "block";
  } else {
    if (viewGuestHome) viewGuestHome.style.display = "block";
    if (viewLoggedHome) viewLoggedHome.style.display = "none";
  }
}

// BƯỚC 4: Chuyển tới màn hình Tra cứu hóa đơn
function navigateToLookupInvoices() {
  if (!currentUser) {
    openLoginPopup();
    return;
  }

  document.body.classList.add("lookup-mode");
  const viewGuestHome = document.getElementById("view-guest-home");
  const viewLoggedHome = document.getElementById("view-logged-home");
  const viewLookupInvoice = document.getElementById("view-lookup-invoice");

  if (viewGuestHome) viewGuestHome.style.display = "none";
  if (viewLoggedHome) viewLoggedHome.style.display = "none";
  if (viewLookupInvoice) viewLookupInvoice.style.display = "block";

  fetchInvoices();
}

// Khởi tạo khoảng thời gian tra cứu mặc định (30 ngày gần nhất)
function initDateFilters() {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);

  const formatDDMMYYYY = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const inpFrom = document.getElementById("f-from-date");
  const inpTo = document.getElementById("f-to-date");
  if (inpFrom) inpFrom.value = formatDDMMYYYY(fromDate);
  if (inpTo) inpTo.value = formatDDMMYYYY(toDate);

  // Gắn auto-format khi gõ
  ["f-from-date", "f-to-date"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", function() {
      let v = this.value.replace(/\D/g, "");
      if (v.length >= 3) v = v.slice(0,2) + "/" + v.slice(2);
      if (v.length >= 6) v = v.slice(0,5) + "/" + v.slice(5,9);
      this.value = v;
    });
  });
}

// Xử lý khi đổi loại kỳ tính thuế
function handlePeriodChange() {
  const period = document.getElementById("f-period-type").value;
  const now = new Date();
  const fmt = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  if (period === "month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    document.getElementById("f-from-date").value = fmt(firstDay);
    document.getElementById("f-to-date").value   = fmt(lastDay);
  } else if (period === "quarter") {
    const quarter  = Math.floor(now.getMonth() / 3);
    const firstDay = new Date(now.getFullYear(), quarter * 3, 1);
    const lastDay  = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    document.getElementById("f-from-date").value = fmt(firstDay);
    document.getElementById("f-to-date").value   = fmt(lastDay);
  } else {
    initDateFilters();
  }
}

// Chuyển đổi 2 TAB CHA: Bán ra / Mua vào
function switchParentTab(parentTab) {
  currentParentTab = parentTab;
  currentPage = 1;

  // Dùng ant-tabs-tab-active class theo chuẩn GDT
  const tabBanRa = document.getElementById("tab-parent-ban-ra");
  const tabMuaVao = document.getElementById("tab-parent-mua-vao");
  const inkBar = document.getElementById("parent-tab-ink-bar");

  if (tabBanRa) {
    tabBanRa.classList.toggle("ant-tabs-tab-active", parentTab === "ban-ra");
    tabBanRa.setAttribute("aria-selected", parentTab === "ban-ra" ? "true" : "false");
  }
  if (tabMuaVao) {
    tabMuaVao.classList.toggle("ant-tabs-tab-active", parentTab === "mua-vao");
    tabMuaVao.setAttribute("aria-selected", parentTab === "mua-vao" ? "true" : "false");
  }

  // Cập nhật vị trí ink bar
  if (inkBar) {
    if (parentTab === "ban-ra") {
      inkBar.style.transform = "translate3d(0px, 0px, 0px)";
      inkBar.style.width = (tabBanRa ? tabBanRa.offsetWidth : 220) + "px";
    } else {
      const offset = tabBanRa ? tabBanRa.offsetWidth : 220;
      inkBar.style.transform = `translate3d(${offset}px, 0px, 0px)`;
      inkBar.style.width = (tabMuaVao ? tabMuaVao.offsetWidth : 220) + "px";
    }
  }

  // Cập nhật ld-header ribbon title text
  const headerText = document.getElementById("ld-header-text");
  if (headerText) {
    headerText.textContent = parentTab === "ban-ra"
      ? "Danh sách hóa đơn điện tử bán ra"
      : "Danh sách hóa đơn điện tử mua vào";
  }

  // Cập nhật label MST và CCCD trên form
  const labelPartnerTaxMain = document.getElementById("label-partner-tax-main");
  const labelCccd = document.getElementById("label-cccd");
  const colInfoPartner = document.getElementById("col-info-partner");
  if (parentTab === "ban-ra") {
    if (labelPartnerTaxMain) labelPartnerTaxMain.textContent = "MST người mua";
    if (labelCccd) labelCccd.textContent = "CCCD người mua";
    if (colInfoPartner) colInfoPartner.textContent = "Thông tin hóa đơn";
  } else {
    if (labelPartnerTaxMain) labelPartnerTaxMain.textContent = "MST người bán";
    if (labelCccd) labelCccd.textContent = "CCCD người bán";
    if (colInfoPartner) colInfoPartner.textContent = "Thông tin người bán";
  }

  // Cập nhật dropdown Kết quả kiểm tra theo tab bán ra / mua vào
  updateCheckResultOptions(parentTab);

  fetchInvoices();
}

// Cập nhật options cho select Kết quả kiểm tra (*) tùy theo Bán ra / Mua vào
function updateCheckResultOptions(parentTab) {
  const select = document.getElementById("f-cqt-result");
  if (!select) return;

  if (parentTab === "ban-ra") {
    select.innerHTML = `
      <option value="ALL" selected>Tất cả</option>
      <option value="1">Cục Thuế đã nhận</option>
      <option value="2">Đang tiến hành kiểm tra điều kiện cấp mã</option>
      <option value="3">CQT từ chối hóa đơn theo từng lần phát sinh</option>
      <option value="4">Hóa đơn đủ điều kiện cấp mã</option>
      <option value="7">Hóa đơn không đủ điều kiện cấp mã</option>
      <option value="5">Đã cấp mã hóa đơn</option>
      <option value="6">Đã kiểm tra định kỳ HĐĐT không có mã</option>
      <option value="mtt">Cục Thuế đã nhận hóa đơn có mã khởi tạo từ máy tính tiền</option>
    `;
  } else {
    select.innerHTML = `
      <option value="5" selected>Đã cấp mã hóa đơn</option>
      <option value="khongma">Cục Thuế đã nhận không mã</option>
      <option value="mtt">Cục Thuế đã nhận hóa đơn có mã khởi tạo từ máy tính tiền</option>
    `;
  }
}

// Chuyển đổi 2 TAB CON: Hóa đơn điện tử / Máy tính tiền
function switchSubTab(subTab) {
  currentSubTab = subTab;
  currentPage = 1;

  const tabHddt = document.getElementById("tab-sub-hddt");
  const tabMtt  = document.getElementById("tab-sub-mtt");
  const inkBar  = document.getElementById("sub-tab-ink-bar");

  if (tabHddt) {
    tabHddt.classList.toggle("ant-tabs-tab-active", subTab === "hddt");
  }
  if (tabMtt) {
    tabMtt.classList.toggle("ant-tabs-tab-active", subTab === "mtt");
  }

  if (inkBar) {
    if (subTab === "hddt") {
      inkBar.style.transform = "translate3d(0px, 0px, 0px)";
      inkBar.style.width = (tabHddt ? tabHddt.offsetWidth : 120) + "px";
    } else {
      const offset = tabHddt ? tabHddt.offsetWidth : 120;
      inkBar.style.transform = `translate3d(${offset}px, 0px, 0px)`;
      inkBar.style.width = (tabMtt ? tabMtt.offsetWidth : 250) + "px";
    }
  }

  fetchInvoices();
}

// Tải dữ liệu hóa đơn từ Server
async function fetchInvoices() {
  const tbody = document.getElementById("invoice-tbody");
  if (!tbody) return;
  const COLS = 18;
  tbody.innerHTML = `<tr><td colspan="${COLS}" style="text-align: center; padding: 25px; color: #888;">⏳ Đang tải dữ liệu hóa đơn...</td></tr>`;

  const nmmst    = (document.getElementById("nmmst")    || {}).value || "";
  const shdon    = (document.getElementById("shdon")    || {}).value || "";
  const khhdon   = (document.getElementById("khhdon")   || {}).value || "";
  const khmshdon = (document.getElementById("khmshdon") || {}).value || "";
  const status   = (document.getElementById("f-status")     || {}).value || "ALL";
  const cqtResult = (document.getElementById("f-cqt-result") || {}).value || "ALL";

  // Parse dd/mm/yyyy → ISO yyyy-mm-dd cho API
  const parseDDMMYYYY = (str) => {
    if (!str || str.length < 10) return "";
    const parts = str.split("/");
    if (parts.length !== 3) return "";
    const [dd, mm, yyyy] = parts;
    if (!dd || !mm || !yyyy || yyyy.length !== 4) return "";
    return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  };
  const fromDateRaw = (document.getElementById("f-from-date") || {}).value || "";
  const toDateRaw   = (document.getElementById("f-to-date")   || {}).value || "";
  const fromDate = parseDDMMYYYY(fromDateRaw);
  const toDate   = parseDDMMYYYY(toDateRaw);

  const queryParams = new URLSearchParams({
    type: currentParentTab,
    subType: currentSubTab,
    page: currentPage,
    pageSize: pageSize
  });

  if (nmmst)    queryParams.append("taxCode", nmmst);
  if (shdon)    queryParams.append("invoiceNumber", shdon);
  if (khhdon)   queryParams.append("invoiceSeries", khhdon);
  if (khmshdon) queryParams.append("templateCode", khmshdon);
  if (fromDate) queryParams.append("fromDate", fromDate);
  if (toDate)   queryParams.append("toDate", toDate);
  if (status && status !== "ALL")    queryParams.append("status", status);
  if (cqtResult && cqtResult !== "ALL") queryParams.append("checkResult", cqtResult);

  try {
    const res = await fetch(`/api/invoices?${queryParams.toString()}`);
    const data = await res.json();

    if (data.success) {
      currentInvoices = data.data;
      selectedInvoiceId = null;
      renderInvoiceTable(data);
    } else {
      tbody.innerHTML = `<tr><td colspan="${COLS}" style="text-align: center; color: red;">Lỗi: ${data.message}</td></tr>`;
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="${COLS}" style="text-align: center; color: red;">Lỗi kết nối tới máy chủ.</td></tr>`;
  }
}

// Vẽ bảng dữ liệu hóa đơn (18 cột chuẩn GDT)
function renderInvoiceTable(response) {
  const tbody = document.getElementById("invoice-tbody");
  const invoices = response.data;
  const total = response.total;
  const COLS = 18;

  const totalEl = document.getElementById("val-total-records");
  if (totalEl) totalEl.textContent = total;

  // Update toolbar pagination
  const currEl  = document.getElementById("val-page-current");
  const totPages = document.getElementById("val-page-total");
  const totalPages = response.totalPages || 1;
  if (currEl)  currEl.textContent  = response.page || 1;
  if (totPages) totPages.textContent = totalPages;

  const btnPrev = document.getElementById("btn-page-prev");
  const btnNext = document.getElementById("btn-page-next");
  if (btnPrev) btnPrev.disabled = (response.page <= 1);
  if (btnNext) btnNext.disabled = (response.page >= totalPages);

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${COLS}" style="text-align: center; padding: 30px; color: #8c8c8c; font-size: 13px;">Không có dữ liệu hóa đơn nào phù hợp với điều kiện tìm kiếm.</td></tr>`;
    return;
  }

  const startIdx = (response.page - 1) * response.pageSize + 1;
  const formatVND = (num) => {
    if (!num && num !== 0) return "";
    return new Intl.NumberFormat("vi-VN").format(num);
  };
  const fmtDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("vi-VN", {day:"2-digit", month:"2-digit", year:"numeric"});
  };

  tbody.innerHTML = invoices.map((inv, idx) => {
    // Cột MST: Bán ra lấy từ nbmst, Đầu vào (mua vào) lấy từ nmmst
    const mst = currentParentTab === "ban-ra" ? (inv.nbmst || "") : (inv.nmmst || "");
    const issueDateStr = fmtDate(inv.issueDate);

    // Cột Thông tin hóa đơn (đầu ra) / Thông tin người bán (đầu vào)
    let infoCell = "";
    if (currentParentTab === "ban-ra") {
      const buyerName = inv.buyerName || "(Khách lẻ không lấy hóa đơn)";
      if (inv.buyerTaxCode) {
        infoCell = `<div style="font-size:12px; line-height:1.45;">
          <div>MST người mua: ${inv.buyerTaxCode}</div>
          <div>Tên người mua: ${buyerName}</div>
        </div>`;
      } else {
        infoCell = `<div style="font-size:12px; line-height:1.45;">
          <div>Tên người mua: ${buyerName}</div>
        </div>`;
      }
    } else {
      // Đầu vào (mua vào)
      const sellerMst = inv.sellerTaxCode || inv.nbmst || "";
      const sellerName = inv.sellerName || "";
      infoCell = `<div style="font-size:12px; line-height:1.45;">
        <div>MST người bán: ${sellerMst}</div>
        <div>Tên người bán: ${sellerName}</div>
      </div>`;
    }

    const isSelected = selectedInvoiceId === inv.id;

    return `<tr id="inv-row-${inv.id}" class="${isSelected ? 'ant-table-row-selected' : ''}" onclick="selectInvoiceRow('${inv.id}')" ondblclick="viewInvoiceDetail('${inv.id}')">
      <td class="ant-table-align-center" style="font-size:12px;">${startIdx + idx}</td>
      <td class="ant-table-align-center" style="font-size:11.5px; font-family:monospace;">${mst}</td>
      <td class="ant-table-align-center" style="font-size:12px;">${inv.templateCode || ""}</td>
      <td class="ant-table-align-center" style="font-size:12px; font-weight:600;">${inv.invoiceSeries || ""}</td>
      <td class="ant-table-align-center" style="font-size:12px; font-weight:600; color:#7a2b16;">${inv.invoiceNumber || ""}</td>
      <td class="ant-table-align-center" style="font-size:12px;">${issueDateStr}</td>
      <td style="padding:6px 10px;">${infoCell}</td>
      <td style="text-align:right; font-size:12px; padding:6px 8px;">${formatVND(inv.subTotal)}</td>
      <td style="text-align:right; font-size:12px; padding:6px 8px;">${formatVND(inv.vatAmount)}</td>
      <td style="text-align:right; font-size:12px; padding:6px 8px;">${formatVND(inv.ttcktmai)}</td>
      <td class="ant-table-align-center" style="font-size:12px;"></td>
      <td style="text-align:right; font-size:12px; padding:6px 8px; font-weight:600; color:#7a2b16;">${formatVND(inv.totalAmount)}</td>
      <td class="ant-table-align-center" style="font-size:12px;">VND</td>
      <td class="ant-table-align-center">
        <span class="badge-status ${inv.statusBadge || ''}" style="font-size:11px;">${inv.invoiceStatus || ""}</span>
      </td>
      <td class="ant-table-align-center">
        <span class="badge-status ${inv.cqtBadge || ''}" style="font-size:11px;">${inv.cqtStatus || ""}</span>
      </td>
      <td class="ant-table-align-center" style="font-size:11.5px; color:#237804;">
        ${inv.cqtCheckDetail || "Hóa đơn hợp lệ"}
      </td>
      <td class="ant-table-align-center" style="font-size:11.5px; color:#8c8c8c;">
        ${inv.relatedInvoice || "---"}
      </td>
      <td class="ant-table-align-center" style="font-size:11.5px; color:#8c8c8c;">
        ${inv.relatedInfo || "---"}
      </td>
    </tr>`;
  }).join("");
}

// Chọn dòng hóa đơn khi click
function selectInvoiceRow(id) {
  selectedInvoiceId = id;
  const rows = document.querySelectorAll("#invoice-tbody tr");
  rows.forEach(tr => {
    tr.classList.remove("ant-table-row-selected");
  });
  const row = document.getElementById(`inv-row-${id}`);
  if (row) {
    row.classList.add("ant-table-row-selected");
  }
}

// Xử lý nút Xem hóa đơn trên thanh toolbar
function handleToolbarView() {
  if (!selectedInvoiceId) {
    alert("Vui lòng click chọn một dòng hóa đơn để xem chi tiết!");
    return;
  }
  viewInvoiceDetail(selectedInvoiceId);
}

// Xử lý nút Tải XML trên thanh toolbar
function handleToolbarDownloadXml() {
  if (!selectedInvoiceId) {
    alert("Vui lòng click chọn một dòng hóa đơn để tải file XML!");
    return;
  }
  downloadXml(selectedInvoiceId);
}

// Phân trang
function renderPagination(currentPage, totalPages) {
  const container = document.getElementById("pagination-controls");
  let html = "";

  html += `<button class="tbl-action-btn" ${currentPage === 1 ? "disabled" : ""} onclick="goToPage(${currentPage - 1})">❮</button>`;
  for (let i = 1; i <= totalPages; i++) {
    const isAct = i === currentPage;
    html += `<button class="tbl-action-btn" style="${isAct ? 'background: var(--gdt-brown); color: #fff; font-weight: bold;' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  html += `<button class="tbl-action-btn" ${currentPage === totalPages ? "disabled" : ""} onclick="goToPage(${currentPage + 1})">❯</button>`;
  container.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  fetchInvoices();
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    fetchInvoices();
  }
}

function nextPage() {
  currentPage++;
  fetchInvoices();
}

function changePageSize() {
  const el = document.getElementById("f-pagesize");
  if (el) {
    pageSize = parseInt(el.value) || 15;
  }
  currentPage = 1;
  fetchInvoices();
}

function applyFilter() {
  currentPage = 1;
  fetchInvoices();
}

function resetFilter() {
  document.getElementById("search-filter-form").reset();
  updateCheckResultOptions(currentParentTab);
  initDateFilters();
  currentPage = 1;
  fetchInvoices();
}

// Xem chi tiết hóa đơn (Popup Preview)
async function viewInvoiceDetail(invoiceId) {
  try {
    const res = await fetch(`/api/invoices/${invoiceId}`);
    const data = await res.json();
    if (!data.success) {
      alert("Không thể tải chi tiết: " + data.message);
      return;
    }

    const inv = data.data;
    selectedInvoice = inv;
    const formatVND = (num) => new Intl.NumberFormat("vi-VN").format(num);
    const dateObj = new Date(inv.issueDate);
    const isMTT = inv.subType === "mtt";
    const title = isMTT ? "HÓA ĐƠN BÁN HÀNG TỪ MÁY TÍNH TIỀN" : "HÓA ĐƠN GIÁ TRỊ GIA TĂNG";

    document.getElementById("dt-modal-heading").textContent = `CHI TIẾT HÓA ĐƠN - ${inv.invoiceSeries} / ${inv.invoiceNumber}`;

    const sheetHtml = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div style="text-align: center; width: 140px;">
          <img src="/static/images/NTT_Logo_v2.png" style="height: 50px; object-fit: contain;">
        </div>
        <div style="text-align: center; flex: 1;">
          <h2 style="font-size: 20px; font-weight: bold; color: #7a2b16; margin: 0; text-transform: uppercase;">${title}</h2>
          <div style="font-style: italic; font-size: 13px; margin-top: 4px;">
            Ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}
          </div>
        </div>
        <div style="font-size: 13px; line-height: 1.6; text-align: right;">
          <div><strong>Mẫu số:</strong> ${inv.templateCode}</div>
          <div><strong>Ký hiệu:</strong> ${inv.invoiceSeries}</div>
          <div><strong>Số:</strong> <span style="color: #7a2b16; font-weight: bold; font-size: 15px;">${inv.invoiceNumber}</span></div>
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid #7a2b16; margin: 10px 0 16px;">

      <div style="font-size: 13px; line-height: 1.7; margin-bottom: 14px;">
        <div><strong>Đơn vị bán hàng:</strong> <span style="font-weight: bold; text-transform: uppercase;">${inv.sellerName}</span></div>
        <div><strong>Mã số thuế:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: bold;">${inv.sellerTaxCode}</span></div>
        <div><strong>Địa chỉ:</strong> ${inv.sellerAddress}</div>
        ${inv.sellerPhone ? `<div><strong>Điện thoại:</strong> ${inv.sellerPhone}</div>` : ""}
      </div>

      <hr style="border: 0; border-top: 1px dashed #bbb; margin: 10px 0 16px;">

      <div style="font-size: 13px; line-height: 1.7; margin-bottom: 16px;">
        <div><strong>Tên đơn vị mua hàng:</strong> <span style="font-weight: bold; text-transform: uppercase;">${inv.buyerName || "(Khách lẻ không lấy hóa đơn)"}</span></div>
        <div><strong>Mã số thuế:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: bold;">${inv.buyerTaxCode || "---"}</span></div>
        <div><strong>Địa chỉ:</strong> ${inv.buyerAddress || "---"}</div>
        <div><strong>Hình thức thanh toán:</strong> ${inv.paymentMethod} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Đồng tiền:</strong> ${inv.currency}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 15px 0;">
        <thead>
          <tr style="background: #fafafa;">
            <th style="border: 1px solid #333; padding: 6px; text-align: center; width: 40px;">STT</th>
            <th style="border: 1px solid #333; padding: 6px; text-align: left;">Tên hàng hóa, dịch vụ</th>
            <th style="border: 1px solid #333; padding: 6px; text-align: center; width: 70px;">ĐVT</th>
            <th style="border: 1px solid #333; padding: 6px; text-align: right; width: 70px;">Số lượng</th>
            <th style="border: 1px solid #333; padding: 6px; text-align: right; width: 110px;">Đơn giá</th>
            <th style="border: 1px solid #333; padding: 6px; text-align: right; width: 130px;">Thành tiền</th>
            <th style="border: 1px solid #333; padding: 6px; text-align: center; width: 75px;">Thuế suất</th>
          </tr>
        </thead>
        <tbody>
          ${inv.items
            .map(
              (it) => `
            <tr>
              <td style="border: 1px solid #333; padding: 6px; text-align: center;">${it.stt}</td>
              <td style="border: 1px solid #333; padding: 6px;">${it.name}</td>
              <td style="border: 1px solid #333; padding: 6px; text-align: center;">${it.unit}</td>
              <td style="border: 1px solid #333; padding: 6px; text-align: right;">${it.quantity}</td>
              <td style="border: 1px solid #333; padding: 6px; text-align: right;">${formatVND(it.price)}</td>
              <td style="border: 1px solid #333; padding: 6px; text-align: right; font-weight: bold;">${formatVND(it.amount)}</td>
              <td style="border: 1px solid #333; padding: 6px; text-align: center;">${it.vatRate}%</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="border: 1px solid #333; padding: 6px; text-align: right;"><strong>Cộng tiền hàng:</strong></td>
            <td colspan="2" style="border: 1px solid #333; padding: 6px; text-align: right;"><strong>${formatVND(inv.subTotal)} đ</strong></td>
          </tr>
          <tr>
            <td colspan="5" style="border: 1px solid #333; padding: 6px; text-align: right;"><strong>Tiền thuế GTGT:</strong></td>
            <td colspan="2" style="border: 1px solid #333; padding: 6px; text-align: right;"><strong>${formatVND(inv.vatAmount)} đ</strong></td>
          </tr>
          <tr style="background: #fdf5f3;">
            <td colspan="5" style="border: 1px solid #333; padding: 6px; text-align: right; color: #7a2b16; font-size: 14px;"><strong>Tổng thanh toán:</strong></td>
            <td colspan="2" style="border: 1px solid #333; padding: 6px; text-align: right; color: #7a2b16; font-size: 15px;"><strong>${formatVND(inv.totalAmount)} đ</strong></td>
          </tr>
        </tfoot>
      </table>

      <div style="font-size: 13px; margin: 12px 0;">
        <strong>Số tiền viết bằng chữ:</strong> <i>${inv.totalAmountInWords}</i>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 30px;">
        <div style="text-align: center; width: 45%;">
          <strong>NGƯỜI MUA HÀNG</strong><br>
          <span style="font-size: 11px; color: #666;">(Ký, ghi rõ họ tên)</span>
        </div>
        <div style="text-align: center; width: 45%;">
          <strong>NGƯỜI BÁN HÀNG</strong><br>
          <span style="font-size: 11px; color: #666;">(Chữ ký điện tử)</span>
          <div style="margin-top: 10px; border: 2px dashed #1677ff; background: #f0f7ff; padding: 8px; border-radius: 4px; display: inline-block;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
              <img src="/static/images/sign-check.jpg" style="height: 18px;">
              <span style="color: #0958d9; font-weight: bold; font-size: 12px;">ĐÃ KÝ ĐIỆN TỬ BỞI:</span>
            </div>
            <div style="font-size: 12px; font-weight: bold; color: #333; margin-top: 2px;">${inv.signedBy}</div>
            <div style="font-size: 10px; color: #666;">Ngày ký: ${inv.signedDate}</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; display: flex; align-items: center; justify-content: space-between;">
        <div style="border: 2px solid #52c41a; background: #f6ffed; padding: 6px 12px; border-radius: 4px;">
          <div style="color: #237804; font-weight: bold; font-size: 11.5px;">🛡️ MÃ CỦA CƠ QUAN THUẾ:</div>
          <div style="font-family: monospace; font-size: 13px; font-weight: bold; letter-spacing: 1px;">${inv.cqtCode}</div>
          <div style="font-size: 10px; color: #555;">Thời gian cấp mã: ${inv.cqtDate}</div>
        </div>
        <div style="font-size: 11.5px; color: #777; text-align: right;">
          Hóa đơn điện tử có mã của Cơ quan Thuế<br>
          Tra cứu tại Cổng thông tin Hóa đơn điện tử: <i>https://hoadondientu.gdt.gov.vn</i>
        </div>
      </div>
    `;

    document.getElementById("invoice-sheet-container").innerHTML = sheetHtml;
    document.getElementById("invoice-detail-popup").classList.add("open");
  } catch (err) {
    console.error(err);
    alert("Lỗi khi tải chi tiết hóa đơn.");
  }
}

function closeInvoiceDetailPopup() {
  document.getElementById("invoice-detail-popup").classList.remove("open");
  selectedInvoice = null;
}

function downloadXml(invoiceId) {
  window.open(`/api/invoices/${invoiceId}/xml`, "_blank");
}

function exportExcel() {
  window.location.href = `/api/export/csv?type=${currentParentTab}&subType=${currentSubTab}`;
}

// BƯỚC 2: FAKE LUỒNG ĐĂNG NHẬP, BỎ QUA CAPTCHA
function openLoginPopup() {
  document.getElementById("login-popup").classList.add("open");
}

function closeLoginPopup() {
  document.getElementById("login-popup").classList.remove("open");
}

function regenerateCaptcha() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById("captcha-code-txt").textContent = code;
  document.getElementById("inp-login-captcha").value = code;
}

async function doLogin() {
  const username = document.getElementById("inp-login-username").value.trim();
  const password = document.getElementById("inp-login-password").value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem("gdt_active_user", JSON.stringify(currentUser));
      closeLoginPopup();
      initViewByAuth();
    }
  } catch (err) {
    console.error(err);
    alert("Lỗi kết nối máy chủ");
  }
}

async function doLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (e) {}
  currentUser = null;
  localStorage.removeItem("gdt_active_user");
  initViewByAuth();
}
