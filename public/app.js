// cat care system frontend

let token = "";
let role = "";
let username = "";
let staffId = "";
let currentArea = "";
let editingCheckinId = null;
let editingIncidentId = null;
let pictureData = "";
let allCheckins = [];
let allIncidents = [];
let catDetailFrom = "home";

// fallback cat image when there's no picture on file
let CAT_PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
  '<rect fill="#f5ede2" width="200" height="200"/>' +
  '<path d="M50 90 L40 40 L90 65 Q100 60 110 65 L160 40 L150 90 Q160 110 155 135 Q145 175 100 175 Q55 175 45 135 Q40 110 50 90 Z" fill="#d4a373"/>' +
  '<circle cx="80" cy="110" r="7" fill="#3b2b1a"/>' +
  '<circle cx="120" cy="110" r="7" fill="#3b2b1a"/>' +
  '<path d="M95 130 Q100 135 105 130" stroke="#3b2b1a" stroke-width="3" fill="none"/>' +
  '<path d="M85 145 Q100 155 115 145" stroke="#3b2b1a" stroke-width="2" fill="none"/>' +
  '</svg>'
);

function el(id) {
  return document.getElementById(id);
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token
  };
}

function escapeText(x) {
  let d = document.createElement("div");
  d.textContent = x == null ? "" : x;
  return d.innerHTML;
}

// used when a string goes inside an inline onclick
function safeForAttr(s) {
  let str = String(s == null ? "" : s);
  str = str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  str = str.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return str;
}

function fmtDate(v) {
  if (!v) return "-";
  let d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function switchView(name) {
  let views = document.querySelectorAll(".view");
  for (let i = 0; i < views.length; i++) {
    views[i].classList.add("hidden");
  }
  el("view-" + name).classList.remove("hidden");

  if (name === "home") {
    el("homeBtn").classList.add("hidden");
  } else {
    el("homeBtn").classList.remove("hidden");
  }

  window.scrollTo(0, 0);
}

// re-renders whatever view is currently visible
function refreshCurrentView() {
  if (!el("view-dashboard").classList.contains("hidden")) {
    renderDash();
  } else if (!el("view-flagged").classList.contains("hidden")) {
    renderFlaggedFromMemory();
  }
}

// login

function doLogin() {
  let u = el("username").value.trim();
  let p = el("password").value.trim();
  let err = el("loginError");

  if (!u || !p) {
    err.textContent = "type a username and a password";
    err.style.display = "block";
    return;
  }

  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p })
  }).then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) {
        err.textContent = data.error;
        err.style.display = "block";
        return;
      }
      token = data.token;
      role = data.role;
      username = data.username;
      staffId = data.staffId || "-";
      localStorage.setItem("ccToken", token);
      localStorage.setItem("ccRole", role);
      localStorage.setItem("ccUser", username);
      localStorage.setItem("ccStaff", staffId);
      enterShell();
    });
  }).catch(function() {
    err.textContent = "couldnt reach the server";
    err.style.display = "block";
  });
}

function enterShell() {
  el("loginError").style.display = "none";
  el("username").value = "";
  el("password").value = "";
  el("loginScreen").classList.add("hidden");
  el("shell").classList.remove("hidden");
  el("userLabel").textContent = username + " · " + staffId + " · " + role;

  let adminTiles = document.querySelectorAll(".admin-only");
  for (let i = 0; i < adminTiles.length; i++) {
    adminTiles[i].style.display = (role === "admin") ? "" : "none";
  }

  switchView("home");
  refreshUrgentBanner();
}

function doLogout() {
  token = "";
  role = "";
  username = "";
  staffId = "";
  localStorage.clear();
  el("shell").classList.add("hidden");
  el("loginScreen").classList.remove("hidden");
}


function refreshUrgentBanner() {
  if (role !== "admin") return;

  fetch("/api/incidents", { headers: authHeaders() })
    .then(function(res) { return res.json(); })
    .then(function(list) {
      let urgent = list.filter(function(i) {
        return i.medicalAttention === "Immediate attention required" && i.status !== "Resolved";
      });
      let banners = [el("urgentBanner"), el("urgentBanner2")];
      for (let i = 0; i < banners.length; i++) {
        if (!banners[i]) continue;
        if (urgent.length > 0) {
          banners[i].textContent = "⚠ " + urgent.length + " incident(s) need immediate attention";
          banners[i].classList.remove("hidden");
        } else {
          banners[i].classList.add("hidden");
        }
      }
    }).catch(function() {});
}

//checkin

function openCase1() {
  resetCheckin();
  switchView("checkin");
}

function resetCheckin() {
  el("checkinStep1").classList.remove("hidden");
  el("checkinStep2").classList.add("hidden");
  currentArea = "";
  editingCheckinId = null;
  el("submitCheckin").textContent = "Submit Check-In";
}

function pickArea(area) {
  currentArea = area;
  el("checkinAreaLabel").textContent = area;
  el("checkinStep1").classList.add("hidden");
  el("checkinStep2").classList.remove("hidden");

  el("foodTime").value = "";
  el("waterTime").value = "";
  el("foodOk").checked = false;
  el("waterOk").checked = false;
  el("noThreats").checked = false;
  el("checkinNotes").value = "";
  el("flagFollow").checked = false;
}

function submitCheckin() {
  let body = {
    area: currentArea,
    foodRefillTime: el("foodTime").value,
    waterRefillTime: el("waterTime").value,
    foodOk: el("foodOk").checked,
    waterOk: el("waterOk").checked,
    noThreats: el("noThreats").checked,
    notes: el("checkinNotes").value.trim(),
    flagForFollowUp: el("flagFollow").checked
  };

  let url = "/api/checkins";
  let method = "POST";
  if (editingCheckinId) {
    url = "/api/checkins/" + editingCheckinId;
    method = "PUT";
  }

  fetch(url, {
    method: method,
    headers: authHeaders(),
    body: JSON.stringify(body)
  }).then(function(res) {
    if (!res.ok) throw new Error();
    alert("check-in saved");
    editingCheckinId = null;
    switchView("home");
    refreshUrgentBanner();
  }).catch(function() {
    alert("could not save");
  });
}

//incident

function openCase2() {
  resetIncident();
  switchView("incident");
}

function resetIncident() {
  el("catId").value = "";
  el("breed").value = "";
  el("picture").value = "";
  el("picturePreview").classList.add("hidden");
  pictureData = "";
  el("area").value = "";
  el("staffName").value = "";
  el("staffContact").value = "";
  el("logDate").value = new Date().toISOString().slice(0, 10);
  el("taskDue").value = "";
  el("feedingTime").value = "";
  el("waterSupply").value = "";
  el("healthDetails").value = "";
  el("behaviourDetails").value = "";
  el("medicalAttention").value = "";
  el("actionTaken").value = "";
  editingIncidentId = null;
  el("submitIncident").textContent = "Submit Report";
  showStep(1);
}

function showStep(n) {
  if (n === 1) {
    el("incidentStep1").classList.remove("hidden");
    el("incidentStep2").classList.add("hidden");
    el("stepDot1").classList.add("active");
    el("stepDot2").classList.remove("active");
  } else {
    el("incidentStep1").classList.add("hidden");
    el("incidentStep2").classList.remove("hidden");
    el("stepDot1").classList.remove("active");
    el("stepDot2").classList.add("active");
  }
}

function nextIncident() {
  if (!el("catId").value.trim()) { alert("cat id needed"); return; }
  if (!el("area").value) { alert("pick the area"); return; }
  if (!el("staffName").value.trim()) { alert("staff name needed"); return; }
  showStep(2);
}

function onPicturePicked(e) {
  let file = e.target.files[0];
  let prev = el("picturePreview");
  if (!file) {
    pictureData = "";
    prev.classList.add("hidden");
    return;
  }
  let reader = new FileReader();
  reader.onload = function() {
    pictureData = reader.result;
    prev.src = pictureData;
    prev.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function submitIncident() {
  let body = {
    catId: el("catId").value.trim(),
    breed: el("breed").value.trim(),
    picture: pictureData,
    area: el("area").value,
    staffName: el("staffName").value.trim(),
    staffContact: el("staffContact").value.trim(),
    logDate: el("logDate").value,
    taskDue: el("taskDue").value,
    feedingTime: el("feedingTime").value,
    waterSupply: el("waterSupply").value,
    healthDetails: el("healthDetails").value.trim(),
    behaviourDetails: el("behaviourDetails").value.trim(),
    medicalAttention: el("medicalAttention").value,
    actionTaken: el("actionTaken").value.trim()
  };

  let url = "/api/incidents";
  let method = "POST";
  if (editingIncidentId) {
    url = "/api/incidents/" + editingIncidentId;
    method = "PUT";
  }

  fetch(url, {
    method: method,
    headers: authHeaders(),
    body: JSON.stringify(body)
  }).then(function(res) {
    if (!res.ok) throw new Error();
    alert("report saved");
    resetIncident();
    switchView("home");
    refreshUrgentBanner();
  }).catch(function() {
    alert("could not save");
  });
}



function openLookup() {
  el("lookupInput").value = "";
  el("lookupResults").innerHTML = "";
  switchView("lookup");
}

function doLookup() {
  let id = el("lookupInput").value.trim();
  let box = el("lookupResults");

  if (!id) {
    box.innerHTML = "<p class='muted'>type a cat id</p>";
    return;
  }

  fetch("/api/cats/" + encodeURIComponent(id), { headers: authHeaders() })
    .then(function(res) { return res.json(); })
    .then(function(list) {
      if (list.length === 0) {
        box.innerHTML = "<p class='muted'>no records found</p>";
        return;
      }
      let first = list[0];
      let catIdSafe = safeForAttr(first.catId);
      let html = "<h3><button class='cat-link' onclick=\"openCatDetail('" + catIdSafe + "', 'lookup')\">Cat " + escapeText(first.catId) + "</button></h3>";
      html += "<p class='muted small'>Breed: " + escapeText(first.breed || "-");
      html += " · Area: " + escapeText(first.area) + "</p>";
      html += "<table><thead><tr><th>Date</th><th>Medical</th><th>Status</th><th>Action</th></tr></thead><tbody>";
      for (let i = 0; i < list.length; i++) {
        let it = list[i];
        html += "<tr>";
        html += "<td>" + fmtDate(it.createdAt) + "</td>";
        html += "<td>" + escapeText(it.medicalAttention || "-") + "</td>";
        html += "<td>" + escapeText(it.status || "Open") + "</td>";
        html += "<td>" + escapeText(it.actionTaken || "-") + "</td>";
        html += "</tr>";
      }
      html += "</tbody></table>";
      box.innerHTML = html;
    }).catch(function() {
      box.innerHTML = "<p class='error' style='display:block;'>lookup failed</p>";
    });
}

//specific cat deets

function openCatDetail(catId, from) {
  catDetailFrom = from || "home";
  fetch("/api/cats/" + encodeURIComponent(catId), { headers: authHeaders() })
    .then(function(res) { return res.json(); })
    .then(function(list) {
      renderCatDetail(catId, list);
      switchView("catdetail");
    }).catch(function() {
      alert("could not load cat");
    });
}

function renderCatDetail(catId, incidents) {
  el("catDetailId").textContent = "Cat " + catId;

  // grab the first picture we find
  let pic = "";
  for (let i = 0; i < incidents.length; i++) {
    if (incidents[i].picture) { pic = incidents[i].picture; break; }
  }
  let img = el("catPhoto");
  img.src = pic || CAT_PLACEHOLDER;
  img.alt = "Photo of cat " + catId;

  if (incidents.length > 0) {
    let first = incidents[0];
    el("catDetailMeta").textContent = "Breed: " + (first.breed || "unknown") + " · Last seen in: " + (first.area || "-");
  } else {
    el("catDetailMeta").textContent = "No records yet";
  }

  el("catTotalIncidents").textContent = incidents.length;
  let openCount = 0;
  for (let i = 0; i < incidents.length; i++) {
    if ((incidents[i].status || "Open") !== "Resolved") openCount++;
  }
  el("catOpen").textContent = openCount;
  el("catLatest").textContent = incidents.length > 0 ? (incidents[0].medicalAttention || "-") : "-";

  let rows = "";
  for (let i = 0; i < incidents.length; i++) {
    let it = incidents[i];
    rows += "<tr>";
    rows += "<td>" + fmtDate(it.createdAt) + "</td>";
    rows += "<td>" + escapeText(it.area) + "</td>";
    rows += "<td>" + escapeText(it.staffName) + "</td>";
    rows += "<td>" + escapeText(it.medicalAttention || "-") + "</td>";
    rows += "<td>" + escapeText(it.status || "Open") + "</td>";
    rows += "<td>" + escapeText(it.actionTaken || "-") + "</td>";
    rows += "</tr>";
  }
  if (incidents.length === 0) {
    rows = "<tr><td colspan='6'>no incidents recorded</td></tr>";
  }
  el("catIncidentTable").innerHTML = rows;
}

//dashboard

function openDashboard() {
  Promise.all([
    fetch("/api/checkins", { headers: authHeaders() }).then(function(r) { return r.json(); }),
    fetch("/api/incidents", { headers: authHeaders() }).then(function(r) { return r.json(); })
  ]).then(function(results) {
    allCheckins = results[0];
    allIncidents = results[1];
    renderDash();
    switchView("dashboard");
  }).catch(function() {
    alert("could not load dashboard");
  });
}

function renderDash() {
  el("statCheckins").textContent = allCheckins.length;
  el("statIncidents").textContent = allIncidents.length;

  let urgent = 0;
  let resolved = 0;
  for (let i = 0; i < allIncidents.length; i++) {
    let it = allIncidents[i];
    if (it.medicalAttention === "Immediate attention required" && it.status !== "Resolved") urgent++;
    if (it.status === "Resolved") resolved++;
  }
  el("statUrgent").textContent = urgent;
  el("statResolved").textContent = resolved;

  renderCheckinTable();
  renderIncidentTable();
  refreshUrgentBanner();
}

// builds a filtered array 
function getVisibleCheckins() {
  let fa = el("filterArea").value;
  let fs = el("filterStaff").value.toLowerCase();
  let fd = el("filterDate").value;
  let out = [];
  for (let i = 0; i < allCheckins.length; i++) {
    let c = allCheckins[i];
    if (fa && c.area !== fa) continue;
    if (fs && (c.staff || "").toLowerCase().indexOf(fs) === -1) continue;
    if (fd && (c.createdAt || "").slice(0, 10) !== fd) continue;
    out.push(c);
  }
  return out;
}

function getVisibleIncidents() {
  let fa = el("filterIncArea").value;
  let fm = el("filterMedical").value;
  let fst = el("filterStatus").value;
  let fc = el("filterCat").value.toLowerCase();
  let out = [];
  for (let i = 0; i < allIncidents.length; i++) {
    let it = allIncidents[i];
    if (fa && it.area !== fa) continue;
    if (fm && it.medicalAttention !== fm) continue;
    if (fst && (it.status || "Open") !== fst) continue;
    if (fc && (it.catId || "").toLowerCase().indexOf(fc) === -1) continue;
    out.push(it);
  }
  return out;
}

function renderCheckinTable() {
  let visible = getVisibleCheckins();
  let rows = "";

  for (let i = 0; i < visible.length; i++) {
    let c = visible[i];
    let cls = c.flagForFollowUp ? "flagged" : "";
    let flagLabel = c.flagForFollowUp ? "unflag" : "flag";

    rows += "<tr class='" + cls + "'>";
    rows += "<td>" + escapeText(c.staff || "-") + "</td>";
    rows += "<td>" + escapeText(c.staffId || "-") + "</td>";
    rows += "<td>" + escapeText(c.area) + "</td>";
    rows += "<td>" + (c.foodOk ? "✔" : "✘") + "</td>";
    rows += "<td>" + (c.waterOk ? "✔" : "✘") + "</td>";
    rows += "<td>" + (c.noThreats ? "✔" : "✘") + "</td>";
    rows += "<td>" + escapeText(c.notes || "-") + "</td>";
    rows += "<td>" + fmtDate(c.createdAt) + "</td>";
    rows += "<td class='row-actions'>";
    rows += "<button class='btn small' onclick=\"editCheckin('" + c._id + "')\">edit</button>";
    rows += "<button class='btn small' onclick=\"toggleFlagCheckin('" + c._id + "')\">" + flagLabel + "</button>";
    rows += "<button class='btn small danger' onclick=\"deleteCheckin('" + c._id + "')\">×</button>";
    rows += "</td></tr>";
  }

  if (visible.length === 0) {
    rows = "<tr><td colspan='9'>nothing to show</td></tr>";
  }
  el("checkinTable").innerHTML = rows;
}

function renderIncidentTable() {
  let visible = getVisibleIncidents();
  let rows = "";

  for (let i = 0; i < visible.length; i++) {
    let it = visible[i];

    let rowCls = "";
    if (it.medicalAttention === "Immediate attention required" && it.status !== "Resolved") {
      rowCls = "urgent";
    }

    let pill = "none";
    if (it.medicalAttention === "Mild attention and monitoring") pill = "mild";
    if (it.medicalAttention === "Immediate attention required") pill = "immediate";

    let catSafe = safeForAttr(it.catId);
    let flagLabel = it.flagged ? "unflag" : "flag";

    rows += "<tr class='" + rowCls + "'>";
    rows += "<td><button class='cat-link' onclick=\"openCatDetail('" + catSafe + "', 'dashboard')\">" + escapeText(it.catId) + "</button></td>";
    rows += "<td>" + escapeText(it.breed || "-") + "</td>";
    rows += "<td>" + escapeText(it.area) + "</td>";
    rows += "<td>" + escapeText(it.staffName) + "</td>";
    rows += "<td><span class='pill " + pill + "'>" + escapeText(it.medicalAttention || "-") + "</span></td>";
    rows += "<td><select onchange=\"changeStatus('" + it._id + "', this.value)\">";
    let statuses = ["Open", "In Progress", "Resolved"];
    for (let s = 0; s < statuses.length; s++) {
      let sel = (it.status || "Open") === statuses[s] ? " selected" : "";
      rows += "<option" + sel + ">" + statuses[s] + "</option>";
    }
    rows += "</select></td>";
    rows += "<td>" + escapeText(it.actionTaken || "-") + "</td>";
    rows += "<td>" + fmtDate(it.createdAt) + "</td>";
    rows += "<td class='row-actions'>";
    rows += "<button class='btn small' onclick=\"editIncident('" + it._id + "')\">edit</button>";
    rows += "<button class='btn small' onclick=\"toggleFlagIncident('" + it._id + "')\">" + flagLabel + "</button>";
    rows += "<button class='btn small danger' onclick=\"deleteIncident('" + it._id + "')\">×</button>";
    rows += "</td></tr>";
  }

  if (visible.length === 0) {
    rows = "<tr><td colspan='9'>nothing to show</td></tr>";
  }
  el("incidentTable").innerHTML = rows;
}

function editCheckin(id) {
  let c = null;
  for (let i = 0; i < allCheckins.length; i++) {
    if (allCheckins[i]._id === id) { c = allCheckins[i]; break; }
  }
  if (!c) return;

  currentArea = c.area;
  el("checkinAreaLabel").textContent = c.area;
  el("checkinStep1").classList.add("hidden");
  el("checkinStep2").classList.remove("hidden");
  el("foodTime").value = c.foodRefillTime || "";
  el("waterTime").value = c.waterRefillTime || "";
  el("foodOk").checked = !!c.foodOk;
  el("waterOk").checked = !!c.waterOk;
  el("noThreats").checked = !!c.noThreats;
  el("checkinNotes").value = c.notes || "";
  el("flagFollow").checked = !!c.flagForFollowUp;
  el("submitCheckin").textContent = "Update Check-In";
  editingCheckinId = c._id;
  switchView("checkin");
}

function editIncident(id) {
  let it = null;
  for (let i = 0; i < allIncidents.length; i++) {
    if (allIncidents[i]._id === id) { it = allIncidents[i]; break; }
  }
  if (!it) return;

  resetIncident();
  el("catId").value = it.catId || "";
  el("breed").value = it.breed || "";
  el("area").value = it.area || "";
  el("staffName").value = it.staffName || "";
  el("staffContact").value = it.staffContact || "";
  el("logDate").value = it.logDate || "";
  el("taskDue").value = it.taskDue || "";
  el("feedingTime").value = it.feedingTime || "";
  el("waterSupply").value = it.waterSupply || "";
  el("healthDetails").value = it.healthDetails || "";
  el("behaviourDetails").value = it.behaviourDetails || "";
  el("medicalAttention").value = it.medicalAttention || "";
  el("actionTaken").value = it.actionTaken || "";
  if (it.picture) {
    pictureData = it.picture;
    el("picturePreview").src = it.picture;
    el("picturePreview").classList.remove("hidden");
  }
  editingIncidentId = it._id;
  el("submitIncident").textContent = "Update Report";
  showStep(2);
  switchView("incident");
}

function toggleFlagCheckin(id) {
  let c = null;
  for (let i = 0; i < allCheckins.length; i++) {
    if (allCheckins[i]._id === id) { c = allCheckins[i]; break; }
  }
  if (!c) return;

  let newVal = !c.flagForFollowUp;
  fetch("/api/checkins/" + id, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ flagForFollowUp: newVal })
  }).then(function(res) {
    if (!res.ok) throw new Error();
    c.flagForFollowUp = newVal;
    refreshCurrentView();
  }).catch(function() {
    alert("could not update flag");
  });
}

function toggleFlagIncident(id) {
  let it = null;
  for (let i = 0; i < allIncidents.length; i++) {
    if (allIncidents[i]._id === id) { it = allIncidents[i]; break; }
  }
  if (!it) return;

  let newVal = !it.flagged;
  fetch("/api/incidents/" + id, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ flagged: newVal })
  }).then(function(res) {
    if (!res.ok) throw new Error();
    it.flagged = newVal;
    refreshCurrentView();
  }).catch(function() {
    alert("could not update flag");
  });
}

function changeStatus(id, val) {
  fetch("/api/incidents/" + id, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ status: val })
  }).then(function(res) {
    if (!res.ok) throw new Error();
    for (let i = 0; i < allIncidents.length; i++) {
      if (allIncidents[i]._id === id) { allIncidents[i].status = val; break; }
    }
    refreshCurrentView();
  }).catch(function() {
    alert("could not change status");
  });
}

function deleteCheckin(id) {
  if (!confirm("delete this check-in?")) return;
  fetch("/api/checkins/" + id, {
    method: "DELETE",
    headers: authHeaders()
  }).then(function(res) {
    if (!res.ok) throw new Error();
    let next = [];
    for (let i = 0; i < allCheckins.length; i++) {
      if (allCheckins[i]._id !== id) next.push(allCheckins[i]);
    }
    allCheckins = next;
    refreshCurrentView();
  }).catch(function() {
    alert("could not delete");
  });
}

function deleteIncident(id) {
  if (!confirm("delete this incident?")) return;
  fetch("/api/incidents/" + id, {
    method: "DELETE",
    headers: authHeaders()
  }).then(function(res) {
    if (!res.ok) throw new Error();
    let next = [];
    for (let i = 0; i < allIncidents.length; i++) {
      if (allIncidents[i]._id !== id) next.push(allIncidents[i]);
    }
    allIncidents = next;
    refreshCurrentView();
  }).catch(function() {
    alert("could not delete");
  });
}


function openFlagged() {
  Promise.all([
    fetch("/api/checkins", { headers: authHeaders() }).then(function(r) { return r.json(); }),
    fetch("/api/incidents", { headers: authHeaders() }).then(function(r) { return r.json(); })
  ]).then(function(results) {
    allCheckins = results[0];
    allIncidents = results[1];
    renderFlaggedFromMemory();
    switchView("flagged");
  }).catch(function() {
    alert("could not load flagged items");
  });
}

function renderFlaggedFromMemory() {
  let fc = [];
  for (let i = 0; i < allCheckins.length; i++) {
    if (allCheckins[i].flagForFollowUp) fc.push(allCheckins[i]);
  }
  let fi = [];
  for (let i = 0; i < allIncidents.length; i++) {
    if (allIncidents[i].flagged) fi.push(allIncidents[i]);
  }
  renderFlagged(fc, fi);
}

function renderFlagged(flaggedCheckins, flaggedIncidents) {
  let rowsC = "";
  for (let i = 0; i < flaggedCheckins.length; i++) {
    let c = flaggedCheckins[i];
    rowsC += "<tr>";
    rowsC += "<td>" + escapeText(c.staff || "-") + "</td>";
    rowsC += "<td>" + escapeText(c.staffId || "-") + "</td>";
    rowsC += "<td>" + escapeText(c.area) + "</td>";
    rowsC += "<td>" + escapeText(c.notes || "-") + "</td>";
    rowsC += "<td>" + fmtDate(c.createdAt) + "</td>";
    rowsC += "<td class='row-actions'><button class='btn small' onclick=\"toggleFlagCheckin('" + c._id + "')\">unflag</button></td>";
    rowsC += "</tr>";
  }
  if (flaggedCheckins.length === 0) rowsC = "<tr><td colspan='6'>nothing flagged</td></tr>";
  el("flaggedCheckinTable").innerHTML = rowsC;

  let rowsI = "";
  for (let i = 0; i < flaggedIncidents.length; i++) {
    let it = flaggedIncidents[i];
    let catSafe = safeForAttr(it.catId);
    rowsI += "<tr>";
    rowsI += "<td><button class='cat-link' onclick=\"openCatDetail('" + catSafe + "', 'flagged')\">" + escapeText(it.catId) + "</button></td>";
    rowsI += "<td>" + escapeText(it.area) + "</td>";
    rowsI += "<td>" + escapeText(it.staffName) + "</td>";
    rowsI += "<td>" + escapeText(it.medicalAttention || "-") + "</td>";
    rowsI += "<td>" + escapeText(it.status || "Open") + "</td>";
    rowsI += "<td>" + fmtDate(it.createdAt) + "</td>";
    rowsI += "<td class='row-actions'><button class='btn small' onclick=\"toggleFlagIncident('" + it._id + "')\">unflag</button></td>";
    rowsI += "</tr>";
  }
  if (flaggedIncidents.length === 0) rowsI = "<tr><td colspan='7'>nothing flagged</td></tr>";
  el("flaggedIncidentTable").innerHTML = rowsI;
}


function openTeam() {
  Promise.all([
    fetch("/api/users", { headers: authHeaders() }).then(function(r) { return r.json(); }),
    fetch("/api/checkins", { headers: authHeaders() }).then(function(r) { return r.json(); }),
    fetch("/api/incidents", { headers: authHeaders() }).then(function(r) { return r.json(); })
  ]).then(function(results) {
    renderTeam(results[0], results[1], results[2]);
    switchView("team");
  }).catch(function() {
    alert("could not load team");
  });
}

// count how much each user has contributed
function renderTeam(users, checkins, incidents) {
  let rows = "";
  for (let i = 0; i < users.length; i++) {
    let u = users[i];

    let myCheckins = [];
    for (let a = 0; a < checkins.length; a++) {
      if (checkins[a].staff === u.username) myCheckins.push(checkins[a]);
    }
    let myIncidents = [];
    for (let b = 0; b < incidents.length; b++) {
      if (incidents[b].createdBy === u.username) myIncidents.push(incidents[b]);
    }

    // find the latest activity from both lists
    let latest = 0;
    for (let x = 0; x < myCheckins.length; x++) {
      let t = new Date(myCheckins[x].createdAt).getTime();
      if (t > latest) latest = t;
    }
    for (let y = 0; y < myIncidents.length; y++) {
      let t = new Date(myIncidents[y].createdAt).getTime();
      if (t > latest) latest = t;
    }
    let lastActive = latest ? new Date(latest).toLocaleString() : "-";

    rows += "<tr>";
    rows += "<td><b>" + escapeText(u.username) + "</b></td>";
    rows += "<td>" + escapeText(u.staffId || "-") + "</td>";
    rows += "<td>" + escapeText(u.role || "-") + "</td>";
    rows += "<td>" + myCheckins.length + "</td>";
    rows += "<td>" + myIncidents.length + "</td>";
    rows += "<td>" + lastActive + "</td>";
    rows += "</tr>";
  }
  if (users.length === 0) rows = "<tr><td colspan='6'>no users found</td></tr>";
  el("teamTable").innerHTML = rows;
}


el("loginBtn").addEventListener("click", doLogin);
el("password").addEventListener("keydown", function(e) {
  if (e.key === "Enter") doLogin();
});
el("logoutBtn").addEventListener("click", doLogout);
el("homeBtn").addEventListener("click", function() { switchView("home"); });
el("helpBtn").addEventListener("click", function() { switchView("help"); });

document.querySelectorAll(".case-tile").forEach(function(tile) {
  tile.addEventListener("click", function() {
    let c = tile.getAttribute("data-case");
    if (c === "checkin") openCase1();
    else if (c === "incident") openCase2();
    else if (c === "lookup") openLookup();
    else if (c === "dashboard") openDashboard();
    else if (c === "flagged") openFlagged();
    else if (c === "team") openTeam();
    else if (c === "newuser") window.location.href = "/new";
  });
});

el("backFromCheckin").addEventListener("click", function() { switchView("home"); });
el("backFromIncident").addEventListener("click", function() { switchView("home"); });
el("backFromLookup").addEventListener("click", function() { switchView("home"); });
el("backFromDashboard").addEventListener("click", function() { switchView("home"); });
el("backFromFlagged").addEventListener("click", function() { switchView("home"); });
el("backFromTeam").addEventListener("click", function() { switchView("home"); });
el("backFromHelp").addEventListener("click", function() { switchView("home"); });

// back from cat goes to wherever we came from
el("backFromCat").addEventListener("click", function() {
  if (catDetailFrom === "dashboard") renderDash();
  else if (catDetailFrom === "flagged") renderFlaggedFromMemory();
  switchView(catDetailFrom);
});

document.querySelectorAll(".area-tile").forEach(function(tile) {
  tile.addEventListener("click", function() {
    pickArea(tile.getAttribute("data-area"));
  });
});

el("changeAreaBtn").addEventListener("click", function() {
  el("checkinStep1").classList.remove("hidden");
  el("checkinStep2").classList.add("hidden");
});
el("cancelCheckin").addEventListener("click", function() { switchView("home"); });
el("submitCheckin").addEventListener("click", submitCheckin);

el("nextIncident").addEventListener("click", nextIncident);
el("backIncident").addEventListener("click", function() { showStep(1); });
el("submitIncident").addEventListener("click", submitIncident);
el("picture").addEventListener("change", onPicturePicked);

el("lookupBtn").addEventListener("click", doLookup);
el("lookupInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter") doLookup();
});

document.querySelectorAll("[data-panel]").forEach(function(st) {
  st.addEventListener("click", function() {
    document.querySelectorAll("[data-panel]").forEach(function(x) {
      x.classList.remove("active");
    });
    st.classList.add("active");
    if (st.getAttribute("data-panel") === "checkins") {
      el("panelCheckins").classList.remove("hidden");
      el("panelIncidents").classList.add("hidden");
    } else {
      el("panelCheckins").classList.add("hidden");
      el("panelIncidents").classList.remove("hidden");
    }
  });
});

document.querySelectorAll("[data-fpanel]").forEach(function(st) {
  st.addEventListener("click", function() {
    document.querySelectorAll("[data-fpanel]").forEach(function(x) {
      x.classList.remove("active");
    });
    st.classList.add("active");
    if (st.getAttribute("data-fpanel") === "fcheckins") {
      el("fpanelCheckins").classList.remove("hidden");
      el("fpanelIncidents").classList.add("hidden");
    } else {
      el("fpanelCheckins").classList.add("hidden");
      el("fpanelIncidents").classList.remove("hidden");
    }
  });
});

el("filterArea").addEventListener("change", renderCheckinTable);
el("filterStaff").addEventListener("input", renderCheckinTable);
el("filterDate").addEventListener("change", renderCheckinTable);
el("clearCF").addEventListener("click", function() {
  el("filterArea").value = "";
  el("filterStaff").value = "";
  el("filterDate").value = "";
  renderCheckinTable();
});

el("filterIncArea").addEventListener("change", renderIncidentTable);
el("filterMedical").addEventListener("change", renderIncidentTable);
el("filterStatus").addEventListener("change", renderIncidentTable);
el("filterCat").addEventListener("input", renderIncidentTable);
el("clearIF").addEventListener("click", function() {
  el("filterIncArea").value = "";
  el("filterMedical").value = "";
  el("filterStatus").value = "";
  el("filterCat").value = "";
  renderIncidentTable();
});

// leftover, might use later
function oldRefresh() {
  console.log("refresing...");
}

// resume session if it exists
token = localStorage.getItem("ccToken") || "";
role = localStorage.getItem("ccRole") || "";
username = localStorage.getItem("ccUser") || "";
staffId = localStorage.getItem("ccStaff") || "";

if (token && role) {
  enterShell();
}