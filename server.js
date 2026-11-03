// cat care system backend
// handles login, checkins, incidents, users and cat lookups

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const secretKey = process.env.JWT_SECRET || "change_me";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

let testMode = false;

mongoose.connect(process.env.MONGODB_URI)
  .then(function() { console.log("mongo connected"); })
  .catch(function(e) { console.log("mongo error " + e); });

let userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: "user" },
  staffId: { type: String },
  email: { type: String }
});

let checkinSchema = new mongoose.Schema({
  area: { type: String, required: true },
  foodRefillTime: { type: String },
  waterRefillTime: { type: String },
  foodOk: { type: Boolean, default: false },
  waterOk: { type: Boolean, default: false },
  noThreats: { type: Boolean, default: false },
  notes: { type: String },
  flagForFollowUp: { type: Boolean, default: false },
  staff: { type: String },
  staffId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

let incidentSchema = new mongoose.Schema({
  catId: { type: String, required: true },
  breed: { type: String },
  picture: { type: String },
  area: { type: String, required: true },
  staffName: { type: String, required: true },
  staffContact: { type: String },
  logDate: { type: String },
  taskDue: { type: String },
  feedingTime: { type: String },
  waterSupply: { type: String },
  healthDetails: { type: String },
  behaviourDetails: { type: String },
  medicalAttention: { type: String },
  actionTaken: { type: String },
  status: { type: String, default: "Open" },
  flagged: { type: Boolean, default: false },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});

let User = mongoose.model("User", userSchema);
let Checkin = mongoose.model("Checkin", checkinSchema);
let Incident = mongoose.model("Incident", incidentSchema);

function seedUser(username, password, role, staffId) {
  User.findOne({ username: username }).then(function(found) {
    if (found) return;
    bcrypt.hash(password, 10).then(function(hash) {
      new User({
        username: username,
        passwordHash: hash,
        role: role,
        staffId: staffId
      }).save().then(function() {
        console.log("seeded user " + username);
      });
    });
  });
}

seedUser("admin", "admin123", "admin", "STF-001");
seedUser("user", "user123", "user", "STF-002");

function checkLogin(req, res, next) {
  let header = req.headers.authorization;
  if (!header) {
    res.status(401).json({ error: "log in first" });
    return;
  }
  let token = header.split(" ")[1];
  jwt.verify(token, secretKey, function(err, decoded) {
    if (err) {
      res.status(403).json({ error: "session ended" });
      return;
    }
    req.user = decoded;
    next();
  });
}

function checkAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "admins only" });
    return;
  }
  next();
}

app.post("/api/login", function(req, res) {
  let u = req.body.username;
  let p = req.body.password;

  if (!u || !p) {
    res.status(400).json({ error: "username and password needed" });
    return;
  }

  User.findOne({ username: u }).then(function(user) {
    if (!user) {
      res.status(401).json({ error: "wrong username or password" });
      return;
    }
    bcrypt.compare(p, user.passwordHash).then(function(ok) {
      if (!ok) {
        res.status(401).json({ error: "wrong username or password" });
        return;
      }
      let token = jwt.sign(
        { username: user.username, role: user.role, staffId: user.staffId },
        secretKey,
        { expiresIn: "8h" }
      );
      res.json({
        token: token,
        username: user.username,
        role: user.role,
        staffId: user.staffId
      });
    });
  }).catch(function() {
    res.status(500).json({ error: "login failed" });
  });
});

// list all users for the team view
app.get("/api/users", checkLogin, checkAdmin, function(req, res) {
  User.find({}, "username role staffId").then(function(list) {
    res.json(list);
  }).catch(function() {
    res.status(500).json({ error: "couldnt load users" });
  });
});

app.get("/api/checkins", checkLogin, function(req, res) {
  Checkin.find().sort({ createdAt: -1 }).then(function(list) {
    res.json(list);
  }).catch(function() {
    res.status(500).json({ error: "couldnt load checkins" });
  });
});

app.post("/api/checkins", checkLogin, function(req, res) {
  if (!req.body.area) {
    res.status(400).json({ error: "area required" });
    return;
  }
  let c = new Checkin({
    area: req.body.area,
    foodRefillTime: req.body.foodRefillTime,
    waterRefillTime: req.body.waterRefillTime,
    foodOk: req.body.foodOk,
    waterOk: req.body.waterOk,
    noThreats: req.body.noThreats,
    notes: req.body.notes,
    flagForFollowUp: req.body.flagForFollowUp,
    staff: req.user.username,
    staffId: req.user.staffId
  });
  c.save().then(function(saved) {
    res.status(201).json(saved);
  }).catch(function() {
    res.status(400).json({ error: "save failed" });
  });
});

app.put("/api/checkins/:id", checkLogin, checkAdmin, function(req, res) {
  Checkin.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .then(function(updated) {
      if (!updated) {
        res.status(404).json({ error: "not found" });
        return;
      }
      res.json(updated);
    }).catch(function() {
      res.status(400).json({ error: "update failed" });
    });
});

app.delete("/api/checkins/:id", checkLogin, checkAdmin, function(req, res) {
  Checkin.findByIdAndDelete(req.params.id).then(function() {
    res.json({ message: "deleted" });
  }).catch(function() {
    res.status(400).json({ error: "delete failed" });
  });
});

app.get("/api/incidents", checkLogin, function(req, res) {
  Incident.find().sort({ createdAt: -1 }).then(function(list) {
    res.json(list);
  }).catch(function() {
    res.status(500).json({ error: "couldnt load incidents" });
  });
});

app.post("/api/incidents", checkLogin, function(req, res) {
  if (!req.body.catId || !req.body.area || !req.body.staffName) {
    res.status(400).json({ error: "missing required fields" });
    return;
  }
  let inc = new Incident({
    catId: req.body.catId,
    breed: req.body.breed,
    picture: req.body.picture,
    area: req.body.area,
    staffName: req.body.staffName,
    staffContact: req.body.staffContact,
    logDate: req.body.logDate,
    taskDue: req.body.taskDue,
    feedingTime: req.body.feedingTime,
    waterSupply: req.body.waterSupply,
    healthDetails: req.body.healthDetails,
    behaviourDetails: req.body.behaviourDetails,
    medicalAttention: req.body.medicalAttention,
    actionTaken: req.body.actionTaken,
    status: "Open",
    createdBy: req.user.username
  });
  inc.save().then(function(saved) {
    res.status(201).json(saved);
  }).catch(function() {
    res.status(400).json({ error: "save failed" });
  });
});

app.put("/api/incidents/:id", checkLogin, checkAdmin, function(req, res) {
  Incident.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .then(function(updated) {
      if (!updated) {
        res.status(404).json({ error: "not found" });
        return;
      }
      res.json(updated);
    }).catch(function() {
      res.status(400).json({ error: "update failed" });
    });
});

app.delete("/api/incidents/:id", checkLogin, checkAdmin, function(req, res) {
  Incident.findByIdAndDelete(req.params.id).then(function() {
    res.json({ message: "deleted" });
  }).catch(function() {
    res.status(400).json({ error: "delete failed" });
  });
});

app.get("/api/cats/:catId", checkLogin, function(req, res) {
  Incident.find({ catId: req.params.catId }).sort({ createdAt: -1 })
    .then(function(list) {
      res.json(list);
    }).catch(function() {
      res.status(500).json({ error: "lookup failed" });
    });
});



app.get("/new", function(req, res) {
  res.sendFile(__dirname + "/public/new.html");
});

app.post("/api/register", checkLogin, checkAdmin, function(req, res) {
  var newUsername = req.body.username;
  var newPassword = req.body.password;
  var newStaffId = req.body.staffId;
  var newRole = req.body.role;

  if (!newUsername || !newPassword || !newStaffId) {
    res.status(400).json({ error: "fill in all fields" });
    return;
  }
  if (newRole !== "user" && newRole !== "admin") {
    newRole = "user";
  }

  User.findOne({ username: newUsername }).then(function(found) {
    if (found) {
      res.status(409).json({ error: "username taken" });
      return;
    }
    bcrypt.hash(newPassword, 10).then(function(hash) {
      new User({
        username: newUsername,
        passwordHash: hash,
        role: newRole,
        staffId: newStaffId
      }).save().then(function(saved) {
        res.status(201).json({
          username: saved.username,
          role: saved.role,
          staffId: saved.staffId
        });
      }).catch(function() {
        res.status(400).json({ error: "couldnt save" });
      });
    });
  }).catch(function() {
    res.status(500).json({ error: "register failed" });
  });
});

function oldLog(x) {
  console.log("log: " + x);
}

app.listen(port, function() {
  console.log("server on port " + port);
});