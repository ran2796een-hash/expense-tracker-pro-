// ==========================================
//  Expense Tracker Pro - Full JavaScript
//  يستخدم: Array methods, reduce, map, filter
//  LocalStorage, Chart.js, jsPDF
// ==========================================

// === عناصر الصفحة ===
const $ = (s) => document.querySelector(s);

// === ثوابت التخزين ===
const KEYS = {
  expenses: "etp_expenses",
  budget: "etp_budget",
  dark: "etp_dark",
};

// === البيانات ===
let expenses = [];
let budget = 0;
let editId = null;

// === مساعدات ===
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function money(n) {
  return Number(n).toFixed(2);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// === Toast ===
let toastTimer;
function toast(msg, type = "success") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 2500);
}

// === LocalStorage ===
function loadData() {
  try {
    const raw = localStorage.getItem(KEYS.expenses);
    expenses = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(expenses)) expenses = [];
  } catch {
    expenses = [];
  }
  budget = Number(localStorage.getItem(KEYS.budget)) || 0;
  $("#budgetInput").value = budget || "";

  if (localStorage.getItem(KEYS.dark) === "1") {
    document.body.classList.add("dark");
  }
}

function saveExpenses() {
  localStorage.setItem(KEYS.expenses, JSON.stringify(expenses));
}

function saveBudget() {
  localStorage.setItem(KEYS.budget, String(budget));
}

// === التحقق ===
function validate(d) {
  if (!d.amount || d.amount <= 0) return "المبلغ يجب أن يكون أكبر من 0";
  if (!d.category) return "اختر الفئة";
  if (!d.date) return "اختر التاريخ";
  return null;
}

// === العمليات الحسابية (reduce مطلوبة) ===
function getTotal(list) {
  // استخدام reduce لحساب المجموع الكلي
  return list.reduce((sum, e) => sum + Number(e.amount), 0);
}

function getTotalsByCategory(list) {
  // استخدام reduce لتجميع المصروفات حسب الفئة
  return list.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});
}

function getAverage(list) {
  if (list.length === 0) return 0;
  return getTotal(list) / list.length;
}

function getTopCategory(list) {
  const totals = getTotalsByCategory(list);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0] : null;
}

// === الفلترة والترتيب (filter, sort مطلوبة) ===
function getFiltered() {
  const q = ($("#searchInput").value || "").trim().toLowerCase();
  const cat = $("#filterCategory").value;
  const sort = $("#sortBy").value;

  // استخدام filter للبحث والفلترة
  let list = expenses.filter((e) => {
    const matchCat = cat === "all" || e.category === cat;
    const matchSearch =
      !q ||
      (e.description || "").toLowerCase().includes(q) ||
      (e.category || "").toLowerCase().includes(q) ||
      String(e.amount).includes(q);
    return matchCat && matchSearch;
  });

  // استخدام sort للترتيب
  list = list.slice().sort((a, b) => {
    switch (sort) {
      case "date-desc":
        return (b.date || "").localeCompare(a.date || "");
      case "date-asc":
        return (a.date || "").localeCompare(b.date || "");
      case "amount-desc":
        return Number(b.amount) - Number(a.amount);
      case "amount-asc":
        return Number(a.amount) - Number(b.amount);
      case "category":
        return (a.category || "").localeCompare(b.category || "");
      default:
        return 0;
    }
  });

  return list;
}

// === تحديث الملخص ===
function renderSummary() {
  const total = getTotal(expenses);
  const avg = getAverage(expenses);
  const top = getTopCategory(expenses);

  $("#totalExpenses").textContent = money(total);
  $("#avgExpense").textContent = money(avg);
  $("#countExpenses").textContent = expenses.length;
  $("#topCategory").textContent = top ? `${top[0]} (${money(top[1])})` : "—";

  // الميزانية
  const used = total;
  const rem = Math.max(0, budget - used);
  const pct = budget > 0 ? (used / budget) * 100 : 0;

  $("#usedAmt").textContent = money(used);
  $("#remAmt").textContent = money(rem);

  const bar = $("#budgetBar");
  bar.style.width = Math.min(100, pct) + "%";
  bar.classList.toggle("over", pct > 100);

  const warn = $("#budgetWarning");
  if (budget <= 0) {
    warn.style.display = "none";
  } else if (pct > 100) {
    warn.className = "budget-warning danger";
    warn.textContent = `⚠️ تجاوزت الميزانية بـ ${money(used - budget)}!`;
    warn.style.display = "block";
  } else if (pct >= 80) {
    warn.className = "budget-warning warn";
    warn.textContent = `⚡ استهلكت ${pct.toFixed(0)}% من الميزانية`;
    warn.style.display = "block";
  } else {
    warn.style.display = "none";
  }
}

// === الرسوم البيانية ===
let pieChart = null;
let barChart = null;

function renderCharts() {
  const totals = getTotalsByCategory(expenses);
  const labels = Object.keys(totals);
  const data = Object.values(totals);
  const colors = [
    "#6D5BFF", "#10b981", "#f59e0b", "#ef4444",
    "#3b82f6", "#a855f7", "#06b6d4", "#ec4899", "#14b8a6",
  ];

  // Doughnut Chart
  if (pieChart) pieChart.destroy();
  pieChart = new Chart($("#pieChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0, labels.length) }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom", labels: { font: { size: 12 } } } },
    },
  });

  // Bar Chart - آخر 6 شهور
  const now = new Date();
  const monthLabels = [];
  const monthData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthLabels.push(key);
    // استخدام filter + reduce
    const monthTotal = expenses
      .filter((e) => (e.date || "").startsWith(key))
      .reduce((s, e) => s + Number(e.amount), 0);
    monthData.push(monthTotal);
  }

  if (barChart) barChart.destroy();
  barChart = new Chart($("#barChart"), {
    type: "bar",
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: "المصروفات الشهرية",
          data: monthData,
          backgroundColor: "rgba(109,91,255,.6)",
          borderColor: "#6D5BFF",
          borderWidth: 2,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// === جدول المصروفات ===
function renderTable() {
  const list = getFiltered();
  const tbody = $("#tbody");
  const empty = $("#emptyState");

  $("#tableCount").textContent = `${list.length} عنصر`;

  if (list.length === 0) {
    tbody.innerHTML = "";
    empty.classList.add("show");
    return;
  }

  empty.classList.remove("show");

  // استخدام map لبناء صفوف الجدول
  tbody.innerHTML = list
    .map(
      (e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${money(e.amount)}</b></td>
      <td>${e.category}</td>
      <td>${e.date}</td>
      <td><span class="desc" title="${e.description || ""}">${e.description || "—"}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-ghost" onclick="openEdit('${e.id}')">✏️</button>
          <button class="btn btn-danger" onclick="deleteExp('${e.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");
}

// === تحديث كل شيء ===
function renderAll() {
  renderSummary();
  renderCharts();
  renderTable();
}

// === إضافة مصروف ===
$("#expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const data = {
    amount: Number($("#amount").value),
    category: $("#category").value,
    date: $("#date").value,
    description: ($("#description").value || "").trim(),
  };

  const err = validate(data);
  if (err) return toast(err, "error");

  const newExp = { id: uid(), ...data };
  expenses.push(newExp);
  saveExpenses();
  renderAll();
  $("#expenseForm").reset();
  $("#date").value = todayStr();
  toast("تمت إضافة المصروف بنجاح ✅");
});

// === حذف مصروف ===
function deleteExp(id) {
  const item = expenses.find((e) => e.id === id);
  if (!item) return;
  if (!confirm(`حذف "${item.description || item.category}" بمبلغ ${money(item.amount)}؟`))
    return;

  // استخدام filter للحذف
  expenses = expenses.filter((e) => e.id !== id);
  saveExpenses();
  renderAll();
  toast("تم الحذف 🗑", "info");
  if (editId === id) closeModal();
}

// === Modal تعديل ===
function openEdit(id) {
  const item = expenses.find((e) => e.id === id);
  if (!item) return;

  editId = id;
  $("#eAmount").value = item.amount;
  $("#eCategory").value = item.category;
  $("#eDate").value = item.date;
  $("#eDesc").value = item.description || "";
  $("#modalErr").style.display = "none";

  $("#modal").classList.add("show");
}

function closeModal() {
  $("#modal").classList.remove("show");
  editId = null;
}

$("#modalClose").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) closeModal();
});

$("#modalSave").addEventListener("click", () => {
  if (!editId) return;

  const data = {
    amount: Number($("#eAmount").value),
    category: $("#eCategory").value,
    date: $("#eDate").value,
    description: ($("#eDesc").value || "").trim(),
  };

  const err = validate(data);
  if (err) {
    $("#modalErr").textContent = err;
    $("#modalErr").style.display = "block";
    return;
  }

  // استخدام map للتعديل
  expenses = expenses.map((e) => (e.id === editId ? { ...e, ...data } : e));
  saveExpenses();
  renderAll();
  closeModal();
  toast("تم حفظ التعديل ✅");
});

$("#modalDel").addEventListener("click", () => {
  if (editId) deleteExp(editId);
});

// === الميزانية ===
$("#btnSaveBudget").addEventListener("click", () => {
  const v = Number($("#budgetInput").value);
  if (v < 0) return toast("الميزانية يجب أن تكون 0 أو أكثر", "error");
  budget = v;
  saveBudget();
  renderAll();
  toast("تم حفظ الميزانية 💼");
});

// === Dark Mode ===
$("#toggleDark").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem(KEYS.dark, isDark ? "1" : "0");
  $("#toggleDark").textContent = isDark ? "☀️" : "🌙";
});

// === البحث والفلترة ===
$("#searchInput").addEventListener("input", renderTable);
$("#filterCategory").addEventListener("change", renderTable);
$("#sortBy").addEventListener("change", renderTable);
$("#btnClearFilters").addEventListener("click", () => {
  $("#searchInput").value = "";
  $("#filterCategory").value = "all";
  $("#sortBy").value = "date-desc";
  renderTable();
  toast("تم مسح الفلاتر 🧹", "info");
});

// === تصدير CSV ===
$("#btnExportCSV").addEventListener("click", () => {
  const list = getFiltered();
  if (!list.length) return toast("لا يوجد بيانات للتصدير", "error");

  const headers = ["المبلغ", "الفئة", "التاريخ", "الوصف"];
  // استخدام map لبناء الصفوف
  const rows = list.map((e) =>
    [e.amount, e.category, e.date, e.description || ""].join(",")
  );
  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "expenses.csv";
  a.click();
  URL.revokeObjectURL(url);
  toast("تم تصدير CSV ✅");
});

// === تصدير PDF ===
$("#btnExportPDF").addEventListener("click", () => {
  const list = getFiltered();
  if (!list.length) return toast("لا يوجد بيانات للتصدير", "error");

  const doc = new jspdf.jsPDF();
  doc.setFontSize(16);
  doc.text("Expense Tracker Pro", 14, 18);
  doc.setFontSize(10);
  doc.text(`Total: ${money(getTotal(list))} | Count: ${list.length}`, 14, 28);

  const head = [["Amount", "Category", "Date", "Description"]];
  // استخدام map
  const body = list.map((e) => [
    money(e.amount),
    e.category,
    e.date,
    e.description || "",
  ]);

  doc.autoTable({
    startY: 34,
    head,
    body,
    headStyles: { fillColor: [109, 91, 255] },
    styles: { fontSize: 9 },
  });

  doc.save("expenses.pdf");
  toast("تم تصدير PDF ✅");
});

// === بيانات تجريبية ===
$("#btnDemo").addEventListener("click", () => {
  const demoData = [
    { amount: 350, category: "إيجار", date: "2025-01-01", description: "إيجار الشهر" },
    { amount: 45, category: "طعام", date: "2025-01-03", description: "غداء مطعم" },
    { amount: 120, category: "مواصلات", date: "2025-01-05", description: "بنزين السيارة" },
    { amount: 80, category: "فواتير", date: "2025-01-07", description: "فاتورة كهرباء" },
    { amount: 60, category: "ترفيه", date: "2025-01-10", description: "اشتراك نتفلكس" },
    { amount: 200, category: "مشتريات", date: "2025-01-12", description: "ملابس جديدة" },
    { amount: 35, category: "صحة", date: "2025-01-14", description: "أدوية صيدلية" },
    { amount: 150, category: "تعليم", date: "2025-01-15", description: "كورس أونلاين" },
    { amount: 25, category: "طعام", date: "2025-01-18", description: "بقالة" },
    { amount: 90, category: "أخرى", date: "2025-01-20", description: "هدية" },
    { amount: 70, category: "طعام", date: "2024-12-15", description: "عشاء عائلي" },
    { amount: 55, category: "مواصلات", date: "2024-12-20", description: "تاكسي" },
    { amount: 300, category: "إيجار", date: "2024-12-01", description: "إيجار ديسمبر" },
    { amount: 40, category: "ترفيه", date: "2024-11-25", description: "سينما" },
    { amount: 110, category: "فواتير", date: "2024-11-10", description: "فاتورة إنترنت" },
  ];

  // استخدام map لإضافة id فريد
  const withIds = demoData.map((d) => ({ id: uid(), ...d }));
  expenses = [...withIds, ...expenses];
  saveExpenses();
  renderAll();
  toast("تم تعبئة بيانات تجريبية ✨");
});

// === التشغيل ===
loadData();
$("#date").value = todayStr();
if (document.body.classList.contains("dark")) {
  $("#toggleDark").textContent = "☀️";
}
renderAll();
