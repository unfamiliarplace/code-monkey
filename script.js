import * as pg from "https://cdn.jsdelivr.net/gh/unfamiliarplace/python-generator@latest/pg/__target__/pg.js";

// Turn off when editing. Steals focus from editor
const constantInputFocus = true;

// constant to represent a matching attempt and prompt
const MATCH = -1;

let i = 0;
let stage = null;

let clsResultSuccess = "resultSuccess";
let clsResultFailure = "resultFailure";
let clsResultNeutral = "resultNeutral";
let clsResultSkipped = "resultSkipped";
let canSwitchClass = true;

let caret = null;

let lineFeatures = [
  "comments",
  "statements",
  "expressions",
  "decorators",
  "symbol_practice",
  "real_world"
];

let componentFeatures = [
  "variables",
  "math",
  "strings",
  "booleans",
  "containers",
  "control",
  "indexing",
  "maps",
  "imports",
  "functions",
  "methods",
  "classes",
  "files"
];

let lineFeatureCheckboxes = {};
let componentFeatureCheckboxes = {};
let featureCheckboxes = {};
let featureValues = {};

// TODO
let disabledFeatures = ["maps", "functions", "classes", "files", "containers"];

let statsTemplate = {
  totalPrompts: 0,
  totalCharacters: 0,
  totalCorrectCharacters: 0,
  previousCharacters: 0,
  previousCorrectCharacters: 0,

  failures: 0,
  hasStarted: false,
  timeStarted: 0,
  totalTime: 0,
  SPC: 0,
  CPS: 0,
  accuracy: ""
};

let stats = {};

const colourAttempt = (index) => {
  let text = $("#input").text();
  let cursor = caret.getPos();

  // remove tags
  let html = text;

  if (index !== MATCH) {
    let unspanned = text.substr(0, index);    
    let spanned = text.substr(index);
    
    html = `${unspanned}<span class='markWrong'>${spanned}</span>`;
  }
    
    $("#input").html(html);
    caret.setPos(cursor);
};

const identifyWrongIndex = (prompt, attempt) => {
  // Replace seemingly not identical whitespace characters
  prompt = prompt.replace(/\s+/g, " ");
  attempt = attempt.replace(/\s+/g, " ");

  for (let i = 0; i < attempt.length; i++) {
    if (prompt.length <= i) {
      return i;
    }

    if (prompt[i] !== attempt[i]) {
      return i;
    }
  }

  return MATCH;
};

const evaluatePrompt = () => {
  let prompt = $("#prompt").text();
  let attempt = $("#input").text();

  let wrongIndex = identifyWrongIndex(prompt, attempt);
  let success = attempt.length === prompt.length && wrongIndex === MATCH;
  colourAttempt(wrongIndex);

  if (wrongIndex === MATCH) {
    showNeutral();
  } else {
    showFailure();
  }

  calculateStats(attempt, prompt, success, wrongIndex);
  return success;
};

const updateResult = (text, cls) => {
  let r = $("#result");

  r.removeClass(clsResultSuccess);
  r.removeClass(clsResultFailure);
  r.removeClass(clsResultNeutral);
  r.removeClass(clsResultSkipped);

  r.addClass(cls);
  r.html(text);
};

const showSuccess = () => {
  if (!canSwitchClass) {
    return;
  }
  updateResult("Success", clsResultSuccess);
  setTimeout(showNeutral, 1000);

  canSwitchClass = false;
  setTimeout(() => {
    canSwitchClass = true;
  }, 500);
};

const showFailure = () => {
  if (!canSwitchClass) {
    return;
  }
  updateResult("Fix", clsResultFailure);
  // setTimeout(showNeutral, 1000);
};

const showNeutral = () => {
  if (!canSwitchClass) {
    return;
  }
  updateResult("Type...", clsResultNeutral);
};

const showSkipped = () => {
  if (!canSwitchClass) {
    return;
  }
  updateResult("Skipped", clsResultSkipped);
  setTimeout(showNeutral, 1000);

  canSwitchClass = false;
  setTimeout(() => {
    canSwitchClass = true;
  }, 500);
};

const drawStats = () => {
  $("#statPrompts").html(stats["totalPrompts"]);
  $("#statCharacters").html(stats["totalCharacters"]);
  // $("#statSPC").html(stats["SPC"]);
  $("#statCPS").html(stats["CPS"]);
  $("#statAccuracy").html(stats["accuracy"] + " %");
};

const calculateStats = (attempt, prompt, success, wrongIndex) => {
  let now = Date.now();
  if (stats["timeStarted"] > 0) {
    let seconds = now - stats["timeStarted"];
    stats["totalTime"] += seconds / 1000;
  }
  stats["timeStarted"] = now;

  // update character counts

  let currentCharacters = attempt.length;
  let currentCorrectCharacters =
    wrongIndex === MATCH ? attempt.length : wrongIndex;

  let newCharacters = Math.max(
    0,
    currentCharacters - stats["previousCharacters"]
  );
  let newCorrectCharacters = Math.max(
    0,
    currentCorrectCharacters - stats["previousCorrectCharacters"]
  );

  stats["previousCharacters"] = currentCharacters;
  stats["previousCorrectCharacters"] = currentCorrectCharacters;

  stats["totalCharacters"] += newCharacters;
  stats["totalCorrectCharacters"] += newCorrectCharacters;

  // derive

  stats["SPC"] = (stats["totalTime"] / stats["totalCharacters"]).toFixed(2);
  stats["CPS"] = (stats["totalCharacters"] / stats["totalTime"]).toFixed(2);

  // case where you hit one character and pause :p
  if (!isFinite(stats["CPS"])) {
    stats["CPS"] = 1;
  }

  if (success) {
    stats["totalPrompts"] += 1;
  }

  if (stats["totalCharacters"] === 0) {
    stats["accuracy"] = "";
  } else {
    stats["accuracy"] = (
      (stats["totalCorrectCharacters"] / stats["totalCharacters"]) *
      100
    ).toFixed(2);
  }

  drawStats();
};

const resetStats = () => {
  stats = JSON.parse(JSON.stringify(statsTemplate));
  drawStats();
};

const getNewPrompt = () => {
  for (const [name, opt] of Object.entries(featureCheckboxes)) {
    featureValues[name] = opt.value();
  }

  let newPrompt = pg.pygen.generate(featureValues);
  $("#prompt").html(newPrompt);
  $("#input").text("");

  // only time while they actually type
  stats["timeStarted"] = 0;
  stats["hasStarted"] = false;
};

const getFeatureNiceName = (name) => {
  let parts = name.split("_");
  for (let i = 0; i < parts.length; i++) {
    parts[i] = parts[i][0].toUpperCase() + parts[i].substr(1);
  }
  return parts.join(" ");
};

const createFeature = (name, parent, secondaryCheckboxArray) => {
  let id = `feature-${name}`;
  let niceName = getFeatureNiceName(name);
  let html = `<label for='${id}'>${niceName}<input type='checkbox' id='${id}'></input></label>`;
  parent.append(html);
  let el = $(`#${id}`);
  featureCheckboxes[name] = new OptionCheckbox(el);
  secondaryCheckboxArray[name] = featureCheckboxes[name];
};

const createFeatures = () => {
  let linePanel = $("#lineFeaturesPanel");
  let componentPanel = $("#componentFeaturesPanel");

  for (let name of lineFeatures) {
    createFeature(name, linePanel, lineFeatureCheckboxes);
  }
  for (let name of componentFeatures) {
    createFeature(name, componentPanel, componentFeatureCheckboxes);
  }

  // TODO
  for (let name of disabledFeatures) {
    featureCheckboxes[name].disable(true);
  }
};

const focusInput = () => {
  let el = $("#input");
  el.focus();
  caret.setPos(el.text().length);
};

const skip = () => {
  evaluatePrompt();
  getNewPrompt();
  showSkipped();
  focusInput();
};

const submit = () => {
  if (prompt === "") {
    return;
  }

  if (evaluatePrompt()) {
    getNewPrompt();
    showSuccess();
  }

  focusInput();
};

const setDefaultOptions = () => {
  toggleAllLineFeatures();
  toggleAllComponentFeatures();

  for (let name of disabledFeatures) {
    featureCheckboxes[name].value(false);
  }
};

const toggleFeature = (opt, polarity) => {
  opt.value(polarity && !opt.isDisabled());
};

const toggleAllLineFeatures = () => {
  for (let opt of Object.values(lineFeatureCheckboxes)) {
    toggleFeature(opt, true);
  }
  getNewPrompt();
};

const toggleNoLineFeatures = () => {
  for (let opt of Object.values(lineFeatureCheckboxes)) {
    toggleFeature(opt, false);
  }
  getNewPrompt();
};

const toggleAllComponentFeatures = () => {
  for (let opt of Object.values(componentFeatureCheckboxes)) {
    toggleFeature(opt, true);
  }
  getNewPrompt();
};

const toggleNoComponentFeatures = () => {
  for (let opt of Object.values(componentFeatureCheckboxes)) {
    toggleFeature(opt, false);
  }
  getNewPrompt();
};

const restart = () => {
  resetStats();
  getNewPrompt();
  showNeutral();

  if (constantInputFocus) {
    focusInput();
  }
};

const reset = () => {
  setDefaultOptions();
  restart();
};

const addScenes = () => {
  stage.createScene("game", "#gamePanel");
  stage.createScene("help", "#helpPanel", "#btnHelp");
  stage.setDefault("game");
};

const handleKeydown = (e) => {
  if (constantInputFocus && !$("#input").is(":focus")) {
    focusInput();
  }

  // if ($("#input").is(":focus") && (! stats["hasStarted"])) {
  if (!stats["hasStarted"]) {
    stats["hasStarted"] = true;
    stats["timeStarted"] = Date.now();
  }

  if (["Enter", "NumpadEnter"].includes(e.code)) {
    e.preventDefault();
  }
};

const handleKeyup = (e) => {
  if (["Escape"].includes(e.code)) {
    e.preventDefault();
    skip();
  }

  if (["Enter", "NumpadEnter"].includes(e.code)) {
    e.preventDefault();
  }

  submit();
};

const bind = () => {
  $("#btnSubmit").click(submit);
  $("#btnReset").click(reset);
  $("#btnRestart").click(reset);

  $("#btnAllLineFeatures").click(toggleAllLineFeatures);
  $("#btnNoLineFeatures").click(toggleNoLineFeatures);
  $("#btnAllComponentFeatures").click(toggleAllComponentFeatures);
  $("#btnNoComponentFeatures").click(toggleNoComponentFeatures);

  $("#input").keydown(handleKeydown);
  $("#input").keyup(handleKeyup);

  for (const [name, opt] of Object.entries(featureCheckboxes)) {
    opt.change(restart);
  }
};

const initialize = () => {
  stage = new Stage();
  caret = new VanillaCaret(document.getElementById("input"));
  createFeatures();
  bind();
  addScenes();
  stage.show("game");
  reset();
};

$(document).ready(initialize);