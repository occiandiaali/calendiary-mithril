import "./style.css";
import m from "mithril";
import {
  authenticate,
  initFaceAuth,
  startCamera,
  saveUserFace,
  captureFace,
  matchFace,
  getUserFace,
  registerFace,
} from "./faceAuth";
import {
  getAllEntries,
  getEntry,
  saveEntry,
  deleteEntry,
  clearDB,
  getTodayKey,
  normalizeDateKey,
} from "./db";

import { exportAsCSV, exportAsJSON, emailExport } from "./exportActions";

let state = {
  entries: {},
  modalDate: null,
  modalText: "",
  loggedIn: false,
  currentPage: "calendar",
};

// Utility: random colour generator excluding yellow (#ffff00) and gray (#eeeeee)
function getRandomColor() {
  const excluded = ["#ffff00", "#eeeeee", "#ffffff"];
  let color;
  do {
    color = "#" + Math.floor(Math.random() * 16777215).toString(16);
  } while (excluded.includes(color.toLowerCase()));
  return color;
}

// Store entry colours
let entryColors = {};

//===========
state.currentMonth = new Date().getMonth();
state.currentYear = new Date().getFullYear();

function changeMonth(offset) {
  state.currentMonth += offset;
  if (state.currentMonth < 0) {
    state.currentMonth = 11;
    state.currentYear--;
  } else if (state.currentMonth > 11) {
    state.currentMonth = 0;
    state.currentYear++;
  }
}

function initSession() {
  const loginTime = localStorage.getItem("loginTime");
  if (loginTime) {
    const elapsed = Date.now() - parseInt(loginTime, 10);
    const twelveHours = 12 * 60 * 60 * 1000;
    if (elapsed < twelveHours) {
      state.loggedIn = true;
    }
  }
}
initSession();

function loginUser(video) {
  state.loggedIn = true;
  localStorage.setItem("loginTime", Date.now());
  // stop camera if video element passed
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.remove();
  }
  m.redraw();
}

function logoutUser() {
  state.loggedIn = false;
  state.entries = {};
  state.authStarted = false; // back to landing page
  state.authFailed = false;
  localStorage.removeItem("loginTime");
  m.redraw();
}

function checkAutoLogout() {
  const loginTime = localStorage.getItem("loginTime");
  if (loginTime) {
    const elapsed = Date.now() - parseInt(loginTime, 10);
    const twelveHours = 12 * 60 * 60 * 1000;
    if (elapsed > twelveHours) {
      logoutUser();
    }
  }
}

function getRemainingTime() {
  const loginTime = localStorage.getItem("loginTime");
  if (!loginTime) return null;
  const twelveHours = 12 * 60 * 60 * 1000;
  const remaining = twelveHours - (Date.now() - parseInt(loginTime, 10));
  return remaining > 0 ? remaining : 0;
}

// For calendar correctness
const now = new Date();
const todayY = now.getFullYear();
const todayM = now.getMonth();
const todayD = now.getDate();

const Calendar = {
  oninit: async () => {
    checkAutoLogout();
    if (!state.loggedIn) return;
    const entries = await getAllEntries();
    state.entries = Object.fromEntries(entries.map((e) => [e.date, e.text]));

    entries.forEach((e) => {
      entryColors[e.date] = e.color || getRandomColor();
    });
  },
  view: () => {
    checkAutoLogout();
    if (!state.loggedIn) return null;

    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    const daysInMonth = new Date(
      state.currentYear,
      state.currentMonth + 1,
      0,
    ).getDate();

    const firstDay = new Date(
      state.currentYear,
      state.currentMonth,
      1,
    ).getDay();

    const days = Array.from(
      { length: daysInMonth },
      (_, i) => new Date(state.currentYear, state.currentMonth, i + 1),
    );

    const monthName = new Date(
      state.currentYear,
      state.currentMonth,
    ).toLocaleString("default", { month: "long" });

    return m(".calendar-container", [
      m(".calendar-nav", [
        m(
          "button",
          {
            onclick: () => {
              changeMonth(-1);
              m.redraw();
            },
          },
          "←",
        ),
        m("span", `${monthName} ${state.currentYear}`),
        m(
          "button",
          {
            onclick: () => {
              changeMonth(1);
              m.redraw();
            },
          },
          "→",
        ),
      ]),
      m(
        ".weekdays",
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) =>
          m("div", d),
        ),
      ),
      m(".calendar", [
        // invisible spacers before the first day
        ...Array.from({ length: firstDay }, () => m(".spacer")),
        ...days.map((d) => {
          const dateObj = {
            year: d.getFullYear(),
            month: d.getMonth(),
            day: d.getDate(),
          };
          const dateKey = normalizeDateKey(dateObj);

          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const classes = ["day"];

          if (
            d.getFullYear() === todayY &&
            d.getMonth() === todayM &&
            d.getDate() === todayD
          ) {
            classes.push("today");
          }

          if (isWeekend) classes.push("weekend");

          return m(
            ".day",
            {
              class: classes.join(" "),
              onclick: async () => {
                state.modalDate = dateObj;
                try {
                  const entry = await getEntry(dateObj);
                  state.modalText = entry ? entry.text : "";
                  if (entry && !entryColors[dateKey]) {
                    entryColors[dateKey] = entry.color || getRandomColor();
                  }
                } catch (err) {
                  console.error("Failed to load entry:", err);
                  state.modalText = "";
                }
              },
            },
            state.entries[dateKey]
              ? m(".entry-bar", { style: { background: entryColors[dateKey] } })
              : null,
            d.getDate(),
          );
        }),
      ]),
    ]);
  },
}; // Calendar component

const Modal = {
  oninit: async () => {
    if (state.modalDate) {
      try {
        // Normalize the key automatically in db.js
        const entry = await getEntry(state.modalDate);
        state.modalText = entry ? entry.text : "";
      } catch (err) {
        console.error("Failed to load entry:", err);
        state.modalText = "";
      }
    }
  },

  view: () =>
    state.modalDate
      ? m(".modal", [
          m(
            "h3",
            new Date(
              state.modalDate.year,
              state.modalDate.month,
              state.modalDate.day,
            ).toDateString(),
          ),
          m("textarea", {
            value: state.modalText,
            oninput: (e) => (state.modalText = e.target.value),
          }),
          m(".actions", [
            m(
              "button.entrySave",
              {
                disabled: state.isSaving || !state.modalText.trim(),
                onclick: async () => {
                  state.isSaving = true;
                  m.redraw();

                  try {
                    // const color =
                    //   entryColors[state.modalDate] || getRandomColor();
                    const dateKey = normalizeDateKey(state.modalDate);
                    const color = entryColors[dateKey] || getRandomColor();

                    await saveEntry({
                      date: state.modalDate,
                      text: state.modalText,
                      color,
                    });
                    state.entries[dateKey] = state.modalText;
                    entryColors[dateKey] = color;
                    state.modalDate = null;
                  } catch (err) {
                    console.error("Save failed:", err);
                  } finally {
                    state.isSaving = false;
                    m.redraw();
                  }
                },
              },
              state.isSaving ? "Saving..." : "Save",
            ),
            m(
              "button.entryDel",
              {
                disabled: state.isDeleting || !state.modalText.trim(),
                onclick: async () => {
                  state.isDeleting = true;
                  m.redraw();

                  try {
                    await deleteEntry(state.modalDate);
                    const dateKey = normalizeDateKey(state.modalDate);

                    delete state.entries[dateKey];
                    delete entryColors[dateKey];
                    state.modalDate = null;
                  } catch (err) {
                    console.error("Delete failed:", err);
                  } finally {
                    state.isDeleting = false;
                    m.redraw();
                  }
                },
              },
              state.isDeleting ? "Deleting..." : "Delete",
            ),
            m(
              "button.entryClose",
              { onclick: () => (state.modalDate = null) },
              "Close",
            ),
          ]),
        ])
      : null,
};

const SessionInfo = {
  view: () => {
    const remaining = getRemainingTime();
    if (!remaining) return null;
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return m(".session-info", `Session expires in ${hours}h ${minutes}m`);
  },
};

const CameraAuth = {
  oncreate: async (vnode) => {
    await initFaceAuth();
    const video = document.createElement("video");
    video.autoplay = true;
    video.width = 260;
    video.height = 200;
    vnode.dom.appendChild(video);
    await startCamera(video);

    async function attemptAuth() {
      state.loading = true;
      state.statusMessage = "Scanning your face…";
      m.redraw();

      const success = await authenticate(video);
      state.loading = false;

      if (success) {
        state.statusMessage = "Access granted!";
        loginUser(video);
      } else {
        state.authFailed = true;
        state.statusMessage = "Access denied. Please retry.";
        video.classList.add("video-fail");
      }
      m.redraw();
    }

    setTimeout(attemptAuth, 3000);

    // Save reference so we can stop later
    vnode.state.videoEl = video;
  },
  view: (vnode) =>
    m("div", [
      state.authFailed
        ? m("div.retryAuthDiv", [
            m("p", { style: "color:white" }, state.statusMessage),
            m(
              "button.retryAuthBtn",
              {
                onclick: () => {
                  // Stop camera stream
                  const stream = vnode.state.videoEl?.srcObject;
                  if (stream) {
                    stream.getTracks().forEach((track) => track.stop());
                  }
                  vnode.state.videoEl?.remove();

                  // Reset state
                  state.authFailed = false;
                  state.authStarted = false; // back to landing page
                  state.statusMessage = "";

                  m.redraw();
                },
              },
              "Retry",
            ),
          ])
        : null,
      state.loading
        ? m(".spinner-overlay", [
            m(".spinner"),
            m("div", state.statusMessage || "Authenticating…"),
          ])
        : null,
    ]),
};

import cameraPng from "./assets/camera.png";

//===========================
function hashPassphrase(pass) {
  return btoa(pass); // demo hash; replace with SHA-256 for stronger security
}

const Register = {
  oncreate: async (vnode) => {
    await initFaceAuth();
    const video = document.createElement("video");
    video.autoplay = true;
    video.width = 260;
    video.height = 200;
    vnode.dom.appendChild(video);
    await startCamera(video);

    vnode.state.videoEl = video;
    vnode.state.showPass = false;
    vnode.state.passMatch = null;
  },
  view: (vnode) =>
    m("div.register-box", [
      m("h3", "Register Face + Passphrase"),

      // Passphrase input + toggle
      m("div.passphraseDiv", [
        m("input.passInput", {
          type: vnode.state.showPass ? "text" : "password",
          placeholder: "Enter passphrase",
          oninput: (e) => {
            state.passphrase = e.target.value;
            const storedPass = localStorage.getItem("userPass");
            if (storedPass && state.passphrase) {
              const enteredHash = hashPassphrase(state.passphrase);
              vnode.state.passMatch = storedPass === enteredHash;
            } else {
              vnode.state.passMatch = null;
            }
            m.redraw();
          },
          value: state.passphrase || "",
        }),
        m(
          "button.togglePassBtn",
          {
            onclick: () => (vnode.state.showPass = !vnode.state.showPass),
          },
          vnode.state.showPass ? "Hide" : "Show",
        ),
        vnode.state.passMatch === true
          ? m("span.passMatchIndicator success", "✔")
          : vnode.state.passMatch === false
            ? m("span.passMatchIndicator fail", "✖")
            : null,
      ]),

      vnode.state.passMatch === true
        ? m("small.helperText", "Passphrase matches stored hash.")
        : vnode.state.passMatch === false
          ? m("small.helperText", "Passphrase does not match stored hash.")
          : null,

      // Register button
      m(
        "button.registerBtn",
        {
          onclick: async () => {
            state.statusMessage = "Capturing your face…";
            m.redraw();

            if (!state.passphrase) {
              state.statusMessage = "Passphrase required.";
              m.redraw();
              return;
            }

            const storedPass = localStorage.getItem("userPass");
            const enteredHash = hashPassphrase(state.passphrase);

            if (storedPass && storedPass !== enteredHash) {
              state.statusMessage = "Passphrase mismatch. Cannot overwrite.";
              m.redraw();
              return;
            }

            const success = await registerFace(vnode.state.videoEl);

            if (success) {
              localStorage.setItem("userPass", enteredHash);
              state.statusMessage = "Face + passphrase registered!";
              const stream = vnode.state.videoEl.srcObject;
              if (stream) stream.getTracks().forEach((track) => track.stop());
              vnode.state.videoEl.remove();

              state.reRegistering = false;
              state.passphrase = "";
              m.redraw();
            } else {
              state.statusMessage = "Registration failed.";
            }
          },
        },
        "Register",
      ),

      // Cancel button
      m(
        "button.cancelRegisterBtn",
        {
          onclick: () => {
            const stream = vnode.state.videoEl?.srcObject;
            if (stream) stream.getTracks().forEach((track) => track.stop());
            vnode.state.videoEl?.remove();

            state.reRegistering = false;
            state.passphrase = "";
            state.statusMessage = "";
            m.redraw();
          },
        },
        "Cancel",
      ),
      m(
        "button.clearDataBtn",
        {
          onclick: () => {
            if (
              window.confirm(
                "Are you sure you want to clear your stored face and passphrase? This will log you out.",
              )
            ) {
              // Remove stored face and passphrase
              localStorage.removeItem("userFace");
              localStorage.removeItem("userPass");

              // Stop camera if active
              const stream = vnode.state.videoEl?.srcObject;
              if (stream) stream.getTracks().forEach((track) => track.stop());
              vnode.state.videoEl?.remove();

              // Reset app state
              state.reRegistering = false;
              state.passphrase = "";
              state.statusMessage = "User data cleared. Logged out.";
              state.authStarted = false; // ensures login screen shows again

              m.redraw();
            }
          },
        },
        "Clear Data & Logout",
      ),

      state.statusMessage ? m("p", state.statusMessage) : null,
    ]),
};

//=========================

const Login = {
  view: () =>
    m("div.launchPageDiv", [
      m("h2", "Your Calendiary"),
      !state.authStarted
        ? m("div.camInfoDiv", [
            m("img.startAuthImg", {
              src: `${cameraPng}`,
              onclick: () => {
                state.authStarted = true;
                state.authFailed = false;
              },
            }),
            m("p", "Click the camera to log in"),
            m("span", { style: "color:white" }, "--OR--"),
            m(
              "button.reRegisterBtn",
              {
                onclick: () => {
                  if (
                    window.confirm(
                      "If already registered, this action will overwrite your existing face data. Proceed?",
                    )
                  ) {
                    state.reRegistering = true;
                  }
                },
              },
              "Register Face",
            ),
          ])
        : null,
      state.authStarted ? m(CameraAuth) : null,
      state.reRegistering ? m(".register-overlay", m(Register)) : null,
    ]),
};

import importArrowSvg from "./assets/import-arrow.svg";

// About view
const AboutPage = {
  view: () =>
    m(".aboutPage", [
      m("h2", "About This App"),
      m(
        "p",
        "This diary app lets you record daily entries, color‑code them, and export/import your data.",
      ),
      m(
        "a",
        {
          href: "#",
          onclick: (e) => {
            e.preventDefault();
            state.currentPage = "calendar";
          },
        },
        "Back to Calendar",
      ),
    ]),
};

const CalendarPage = {
  view: () =>
    state.loggedIn
      ? [
          m(SessionInfo),
          m("div.headerDiv", [
            m("h1.appNameh1", "Calendiary"),
            m(
              "a.aboutLink",
              {
                href: "#",
                onclick: (e) => {
                  e.preventDefault();
                  state.currentPage = "about";
                },
              },
              "About",
            ),
          ]),
          m("button.logoutBtn", { onclick: logoutUser }, "Logout"),

          m(
            "button.clearDBtn",
            {
              disabled: state.isClearing,
              onclick: async () => {
                state.isClearing = true;
                m.redraw();
                if (
                  window.confirm(
                    "This action will clear the database, and delete ALL your diary entries. This action cannot be undone. Proceed?",
                  )
                ) {
                  try {
                    await clearDB();

                    // Reset local state
                    state.entries = {};
                    state.entryColors = {};
                    state.modalDate = null;
                    state.modalText = "";

                    // Reload entries to sync UI
                    const entries = await getAllEntries();
                    state.entries = Object.fromEntries(
                      entries.map((e) => [e.date, e.text]),
                    );
                    entries.forEach((e) => {
                      entryColors[e.date] = e.color || getRandomColor();
                    });

                    m.redraw();
                    alert("Database permanently cleared.");
                  } catch (error) {
                    alert(`Error clearing storage: ${error}`);
                  } finally {
                    state.isClearing = false;
                    m.redraw();
                  }
                }
              },
            },
            state.isClearing ? "Clearing.." : "Clear Storage",
          ),
          m("img.importIcon", {
            src: `${importArrowSvg}`,
            width: "32",
            height: "32",
            title: "Import Diary",
            onclick: () => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                  try {
                    await importFromJSON(file);
                    alert("Import complete!");
                    m.redraw();
                  } catch (err) {
                    console.error("Import failed:", err);
                    alert("Failed to import entries.");
                  }
                }
              };
              input.click();
            },
          }),

          m(Calendar),
          m("div.exportDiv", [
            m(".export-actions", [
              m("button.exJson", { onclick: exportAsJSON }, "Export JSON"),
              m("button.exCsv", { onclick: exportAsCSV }, "Export CSV"),
              m("button.exMail", { onclick: emailExport }, "Email Export"),
            ]),
          ]),
          m(Modal),
        ]
      : m(Login),
};

// Root App
const App = {
  view: () => {
    if (state.currentPage === "about") {
      return m(AboutPage);
    }
    return m(CalendarPage);
  },
};

m.mount(document.getElementById("app"), App);

// Update countdown every minute
setInterval(() => {
  if (state.loggedIn) m.redraw();
}, 60000);
