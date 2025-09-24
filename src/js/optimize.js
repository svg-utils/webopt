import { optimize, builtinPlugins, defaultPlugins } from "svgo-ll";
import { hdom } from "./hdom.js";

/**
 * @typedef {"input" | "output"} InputOutputPrefix
 */

hdom.addEventListener("alert-modal-close", "click", () =>
  hdom.closeDialog("alert-modal"),
);
hdom.addEventListener("config-copy", "click", () => copyToClipboard("config"));
hdom.addEventListener("config-close", "click", closeConfig);
hdom.addEventListener("config-open", "click", openConfig);

hdom.addEventListener("config-use-default", "click", setPluginSelection);
hdom.addEventListener("config-use-list", "click", setPluginSelection);
hdom.addEventListener("config-indent", "change", handleConfigChange);
hdom.addEventListener("config-max-passes", "change", handleConfigChange);

hdom.addEventListener("input-type-file", "click", updateInputType);
hdom.addEventListener("input-type-image", "click", updateInputType);
hdom.addEventListener("input-type-url", "click", updateInputType);
hdom.addEventListener("input-type-xml", "click", updateInputType);

hdom.addEventListener("output-type-xml", "click", updateOutputType);
hdom.addEventListener("output-type-image", "click", updateOutputType);

hdom.addEventListener("input-copy", "click", () => copyToClipboard("input"));
hdom.addEventListener("input-download", "click", () => download("input"));
hdom.addEventListener("input-newwindow", "click", () =>
  openInNewWindow("input"),
);
hdom.addEventListener("input-close", "click", () => close("input"));
hdom.addEventListener("input-open", "click", () => open("input"));
hdom.addEventListener("output-copy", "click", () => copyToClipboard("output"));
hdom.addEventListener("output-download", "click", () => download("output"));
hdom.addEventListener("output-newwindow", "click", () =>
  openInNewWindow("output"),
);
hdom.addEventListener("output-close", "click", () => close("output"));
hdom.addEventListener("output-open", "click", () => open("output"));
hdom.addEventListener("output-image", "load", () => handleIFrameLoad("output"));

hdom.addEventListener("input-file-control", "change", handleFileUpload);
hdom.addEventListener("input-xml", "change", () => handleInputChange());
hdom.addEventListener("input-xml", "paste", handlePasteText);
hdom.addEventListener("input-url", "dragenter", (event) => {
  event.preventDefault();
});
hdom.addEventListener("input-url", "dragover", (event) => {
  event.preventDefault();
});
hdom.addEventListener("input-url", "drop", (event) => handleURLDrop(event));
hdom.addEventListener("input-url-control", "paste", handlePasteURL);
hdom.addEventListener("input-image", "load", () => handleIFrameLoad("input"));

hdom.setFocusTo("input-xml");

hdom.addEventListener("info-close", "click", () => openSection("info", false));
hdom.addEventListener("info-open", "click", () => openSection("info"));
hdom.addEventListener("info-plugin-times-close", "click", () =>
  openSection("info-plugin-times", false),
);
hdom.addEventListener("info-plugin-times-open", "click", () =>
  openSection("info-plugin-times"),
);

/** @type {{input?:string,output?:string}} */
const BLOB_URLS = {};

// Generate plugin lists.
const DEFAULT_PLUGIN_NAMES = new Set();

/** @type {("pre"|"plugins"|"post")[]} */
const phases = ["pre", "plugins", "post"];
phases.forEach((phase) => {
  for (const plugin of defaultPlugins[phase]) {
    DEFAULT_PLUGIN_NAMES.add(plugin.name);
  }
});

/** @type {string[]} */
const BUILTIN_PLUGIN_NAMES = [];
for (const pluginName of builtinPlugins.keys()) {
  BUILTIN_PLUGIN_NAMES.push(pluginName);
}

generatePluginList();

/**
 * @param {InputOutputPrefix[]} prefixes
 */
function clearBlob(...prefixes) {
  for (const prefix of prefixes) {
    if (BLOB_URLS[prefix]) {
      URL.revokeObjectURL(BLOB_URLS[prefix]);
      BLOB_URLS[prefix] = undefined;
    }
  }
}

/**
 * @param {string} text
 */
function clearInput(text) {
  clearBlob("input", "output");
  hdom.setFormElementValue("input-xml", text);
}

/**
 * @param {string} prefix
 */
function close(prefix) {
  openSection(prefix, false);
  splitInputAndOutput(false);
}

function closeConfig() {
  openSection("config", false);
}

/**
 * @param {"config"|"input"|"output"} type
 */
function copyToClipboard(type) {
  let content;
  switch (type) {
    case "config":
      content = hdom.getElement("command-line").textContent;
      break;
    case "input":
    case "output":
      content = hdom.getFormElementValue(`${type}-xml`);
      break;
  }
  if (content) {
    window.navigator.clipboard.writeText(content);
    hdom.showDialog("feedback");
    setTimeout(() => {
      hdom.closeDialog("feedback");
    }, 500);
  }
}

/**
 * @param {"input"|"output"} prefix
 */
function download(prefix) {
  // See https://stackoverflow.com/questions/54626186/how-to-download-file-with-javascript
  const fileName = prefix == "input" ? "input.svg" : "optimized.svg";

  // Create a temporary link element
  const link = document.createElement("a");
  link.href = getBlobURL(prefix);
  link.download = fileName;

  // Programmatically click the link to trigger the download
  link.click();
}

function generatePluginList() {
  /**
   * @param {string} id
   * @param {string} name
   * @param {boolean} checked
   * @param {() => void} [listener=handleConfigChange]
   * @returns {HTMLElement}
   */
  function createCheckBox(id, name, checked, listener = handleConfigChange) {
    const div = hdom.createElement("div");
    const checkBox = hdom.createCheckBox(id, checked);
    hdom.addEventListener(checkBox, "click", listener);
    const label = hdom.createTextElement("label", { for: id }, name);
    div.appendChild(checkBox);
    div.appendChild(label);
    return div;
  }

  // Clear existing lists.
  for (const prefix of ["default", "optional", "list"]) {
    hdom.removeChildren(`${prefix}-plugins`);
  }

  const useDefaults = hdom.isChecked("config-use-default");
  hdom.showElement("config-select-plugins-default", useDefaults);
  hdom.showElement("config-select-plugins-list", !useDefaults);

  if (useDefaults) {
    // Show defaults.
    const defaultDiv = hdom.getElement("default-plugins");
    for (const pluginName of DEFAULT_PLUGIN_NAMES) {
      defaultDiv.appendChild(
        createCheckBox(`plugin-${pluginName}`, pluginName, true),
      );
    }

    // Show non-default builtins.
    const otherDiv = hdom.getElement("optional-plugins");
    for (const builtinName of BUILTIN_PLUGIN_NAMES) {
      if (DEFAULT_PLUGIN_NAMES.has(builtinName)) {
        continue;
      }
      otherDiv.appendChild(
        createCheckBox(`plugin-${builtinName}`, builtinName, false),
      );
    }
  } else {
    const div = hdom.getElement("list-plugins");
    for (const builtinName of BUILTIN_PLUGIN_NAMES) {
      const id = `plugin-${builtinName}`;
      div.appendChild(
        createCheckBox(id, builtinName, false, () => handlePluginClick(id)),
      );
    }
  }
}

/**
 * @param {"input"|"output"} prefix
 * @returns {string}
 */
function getBlobURL(prefix) {
  let url = BLOB_URLS[prefix];
  if (!url) {
    const xml = hdom.getFormElementValue(`${prefix}-xml`);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    url = URL.createObjectURL(blob);
    BLOB_URLS[prefix] = url;
  }
  return url;
}

/**
 * @param {import("svgo-ll").Config} config
 * @returns {string}
 */
function getCommandLine(config) {
  const parts = ["svgo-ll"];

  if (config.pluginNames) {
    parts.push("--plugins", ...config.pluginNames);
  }
  if (config.disable) {
    parts.push("--disable", ...config.disable);
  }
  if (config.enable) {
    parts.push("--enable", ...config.enable);
  }

  if (config.maxPasses) {
    parts.push("--max-passes", config.maxPasses.toString());
  }

  if (config.js2svg) {
    if (config.js2svg.pretty) {
      parts.push("--pretty");
      if (config.js2svg.indent) {
        parts.push("--indent", config.js2svg.indent.toString());
      }
    }
  }

  return parts.join(" ");
}

/**
 * @returns {import("svgo-ll").Config}
 */
function getConfig() {
  /** @type {import("svgo-ll").Config} */
  const config = {};

  const useDefaults = hdom.isChecked("config-use-default");

  if (useDefaults) {
    // Find disabled default plugins.
    /** @type {string[]} */
    const disabled = [];
    DEFAULT_PLUGIN_NAMES.forEach((name) => {
      if (!hdom.isChecked(`plugin-${name}`)) {
        disabled.push(name);
      }
    });

    if (disabled.length > 0) {
      config.disable = disabled;
    }

    const enabled = [];
    for (const builtinName of BUILTIN_PLUGIN_NAMES) {
      if (DEFAULT_PLUGIN_NAMES.has(builtinName)) {
        continue;
      }
      const id = `plugin-${builtinName}`;
      if (hdom.isChecked(id)) {
        enabled.push(builtinName);
      }
    }
    if (enabled.length > 0) {
      config.enable = enabled;
    }
  } else {
    const plugins = [];
    const container = hdom.getElement("list-plugins");
    for (const child of container.children) {
      const cb = child.children[0];
      if (hdom.isChecked(cb)) {
        plugins.push(cb.id.split("-")[1]);
      }
    }
    config.pluginNames = plugins;
  }

  const maxPasses = hdom.getFormElementValue("config-max-passes");
  if (maxPasses !== "10") {
    config.maxPasses = parseInt(maxPasses);
  }

  const indent = hdom.getFormElementValue("config-indent");
  switch (indent) {
    case "":
      break;
    case "4":
      config.js2svg = { pretty: true };
      break;
    default:
      config.js2svg = { pretty: true, indent: indent };
      break;
  }

  return config;
}

function handleConfigChange() {
  const config = getConfig();
  const cl = getCommandLine(config);
  hdom.setAttribute("command-line", "title", cl);
  hdom.setElementText("command-line", cl);
  startOptimization(config);
}

/**
 * @param {Event} event
 */
function handleFileUpload(event) {
  const target = event.currentTarget;
  if (target === null || !(target instanceof HTMLInputElement)) {
    return;
  }
  const files = target.files;
  if (!files) {
    return;
  }
  const file = files.item(0);
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.addEventListener(
    "load",
    () => {
      const str = reader.result;
      if (typeof str === "string") {
        optFile(str);
      }
    },
    false,
  );
  reader.readAsText(file);
}

/**
 * @param {InputOutputPrefix} prefix
 */
function handleIFrameLoad(prefix) {
  const element = hdom.getElement(`${prefix}-image`);
  if (element instanceof HTMLIFrameElement) {
    // Remove width/height from <svg> so image scales.
    if (element.contentDocument) {
      for (const child of element.contentDocument.children) {
        if (child.tagName === "svg") {
          const width = child.getAttribute("width");
          const height = child.getAttribute("height");
          child.removeAttribute("width");
          child.removeAttribute("height");
          if (!child.getAttribute("viewBox") && width && height) {
            // No viewBox; create one so image scales.
            child.setAttribute("viewBox", `0 0 ${width} ${height}`);
          }
        }
      }
    }
  }
}

function handleInputChange() {
  const input = hdom.getFormElementValue("input-xml");
  const hasInput = input.trim() !== "";

  // Close the info window.
  close("info");

  // Enable source buttons.
  hdom.enableElement("input-copy", hasInput);
  hdom.enableElement("input-download", hasInput);
  hdom.enableElement("input-newwindow", hasInput);

  if (!hasInput) {
    return;
  }

  startOptimization();
}

function handlePasteText() {
  setTimeout(handleInputChange, 0);
}

function handlePasteURL() {
  setTimeout(optURL, 0);
}

/**
 * @param {string} id
 */
function handlePluginClick(id) {
  /**
   * @returns {Element|undefined}
   */
  function getFirstUncheckedPluginDiv() {
    const container = hdom.getElement("list-plugins");
    for (const child of container.children) {
      if (hdom.isChecked(child.children[0])) {
        continue;
      }
      return child;
    }
  }

  /**
   * @returns {Element|null}
   */
  function getNextUncheckedPluginByName() {
    const container = hdom.getElement("list-plugins");
    for (const child of container.children) {
      const cb = child.children[0];
      if (hdom.isChecked(cb)) {
        continue;
      }
      if (cb.id > id) {
        return child;
      }
    }
    return null;
  }

  const clickedPlugin = hdom.getElement(id);
  const clickedDiv = clickedPlugin.parentNode;
  if (!clickedDiv || !clickedDiv.parentNode) {
    return;
  }
  const isChecked = hdom.isChecked(clickedPlugin);

  if (isChecked) {
    // Move it before the first unchecked plugin.
    const e = getFirstUncheckedPluginDiv();
    if (e) {
      clickedDiv.parentNode.insertBefore(clickedDiv, e);
    }
  } else {
    // Move it back into the unchecked list, in alpha order.
    const e = getNextUncheckedPluginByName();
    clickedDiv.parentNode.insertBefore(clickedDiv, e);
  }

  handleConfigChange();
}

/**
 * @param {Event} event
 */
function handleURLDrop(event) {
  if (!(event instanceof DragEvent) || !event.dataTransfer) {
    return;
  }
  event.preventDefault();
}

/**
 * @param {"input"|"output"} prefix
 * @returns {boolean}
 */
function isOpen(prefix) {
  return !hdom.isHidden(prefix) && !hdom.isHidden(`${prefix}-content`);
}

/**
 * @param {"input"|"output"} prefix
 */
function open(prefix) {
  openSection(prefix);
  splitInputAndOutput(isOpen("input") && isOpen("output"));
}

function openConfig() {
  openSection("config");
}

/**
 * @param {"input"|"output"} prefix
 */
function openInNewWindow(prefix) {
  window.open(getBlobURL(prefix));
}

/**
 * @param {string} prefix
 * @param {boolean} [open=true]
 */
function openSection(prefix, open = true) {
  if (open) {
    hdom.showElement(prefix);
  }
  hdom.showElement(`${prefix}-content`, open);
  hdom.showElement(`${prefix}-close`, open);
  hdom.showElement(`${prefix}-open`, !open);
}

/**
 * @param {string} text
 */
function optFile(text) {
  clearInput(text);
  handleInputChange();
}

/**
 * @param {import("svgo-ll").Config} [config]
 */
function optimizeInput(config) {
  const input = hdom.getFormElementValue("input-xml");
  if (input.trim() === "") {
    // No input; make sure they can enter it.
    hdom.enableElement("input");
    return;
  }

  const pluginTimes = new Map();
  /** @type {number|undefined} */
  let pluginStartTime;
  /**
   * @param {import("svgo-ll").OptimizationCallbackInfo} info
   */
  function callback(info) {
    switch (info.type) {
      case "plugin":
        if (info.event === "begin") {
          pluginStartTime = Date.now();
        } else if (pluginStartTime) {
          const time = Date.now() - pluginStartTime;
          pluginTimes.set(
            info.pluginName,
            time + (pluginTimes.get(info.pluginName) ?? 0),
          );
        }
    }
  }

  clearBlob("output");

  const optimizationData = optimize(input, config ?? getConfig(), callback);

  for (const id of ["input", "output", "info"]) {
    hdom.enableElement(id);
  }

  updateOptimizationFeedback(input, optimizationData, pluginTimes);
}

async function optURL() {
  const urlStr = hdom.getFormElementValue("input-url-control");
  let url;
  try {
    url = new URL(urlStr);
  } catch (error) {
    showModalError(error instanceof Error ? error.message : "Invalid URL");
    return;
  }

  let response;
  try {
    response = await fetch(url);
  } catch {
    // CORS errors don't provide specific information.
    showModalError(`Unable to retrieve ${urlStr}.`);
    return;
  }
  const text = await response.text();
  clearInput(text);
  handleInputChange();
}

function setPluginSelection() {
  generatePluginList();
  handleConfigChange();
}

/**
 * @param {"input"|"output"} prefix
 */
function setSVGImage(prefix) {
  const url = getBlobURL(prefix);
  const element = hdom.getElement(`${prefix}-image`);
  if (element instanceof HTMLIFrameElement && element.contentWindow) {
    element.contentWindow.location.assign(url);
  }
}

/**
 * @param {string} message
 */
function showModalError(message) {
  const dlg = hdom.getElement("alert-modal");
  if (dlg instanceof HTMLDialogElement) {
    hdom.setElementText("alert-modal-msg", message);
    dlg.showModal();
  }
}

/**
 * @param {boolean} split
 */
function splitInputAndOutput(split) {
  for (const type of ["input", "output"]) {
    if (split) {
      hdom.addClass(type, "half");
    } else {
      hdom.removeClass(type, "half");
    }
  }
}

/**
 * @param {import("svgo-ll").Config} [config]
 */
function startOptimization(config) {
  // Disable input while optimization is in progress.
  for (const id of ["input", "output", "info"]) {
    hdom.enableElement(id, false);
  }
  // Set timeout to allow UI updates
  setTimeout(() => {
    optimizeInput(config);
  }, 0);
}

function updateInputType() {
  for (const type of ["file", "image", "url", "xml"]) {
    const isChecked = hdom.isChecked(`input-type-${type}`);
    hdom.showElement(`input-${type}`, isChecked);
    if (isChecked) {
      switch (type) {
        case "url":
          hdom.setFocusTo("input-url-control");
          break;
        case "xml":
          hdom.setFocusTo("input-xml");
          break;
      }
    }
  }
  open("input");
}

/**
 * @param {string} input
 * @param {import("svgo-ll").Output} optimizationData
 * @param {Map<string,number>} pluginTimes
 */
function updateOptimizationFeedback(input, optimizationData, pluginTimes) {
  if (optimizationData.error) {
    if (optimizationData.error instanceof Error) {
      showModalError(optimizationData.error.message);
    }
    return;
  }

  setSVGImage("input");
  updateStats(input, optimizationData, pluginTimes);
  hdom.setTextValue("output-xml", optimizationData.data);
  setSVGImage("output");

  // Allow input to be collapsed.
  hdom.enableElement("input-close");

  // If the input window is open, open the output window as well.
  if (isOpen("input")) {
    open("output");
  }
  openSection("info");
}

function updateOutputType() {
  for (const type of ["image", "xml"]) {
    hdom.showElement(`output-${type}`, hdom.isChecked(`output-type-${type}`));
  }
  open("output");
}

/**
 * @param {string} input
 * @param {import("svgo-ll").Output} output
 * @param {Map<string,number>} pluginTimes
 */
function updateStats(input, output, pluginTimes) {
  const inputSize = input.length;
  const outputSize = output.data.length;
  const bytesSaved = inputSize - outputSize;
  hdom.setElementText("info-input-size", inputSize.toLocaleString());
  hdom.setElementText("info-output-size", outputSize.toLocaleString());
  hdom.setElementText("info-bytes-saved", bytesSaved.toLocaleString());
  hdom.setElementText(
    "info-compression",
    (bytesSaved / inputSize)
      .toLocaleString(undefined, {
        style: "percent",
        maximumFractionDigits: 2,
      })
      .toLocaleString(),
  );
  hdom.setElementText("info-time", JSON.stringify(output.time));
  hdom.setElementText("info-parse-time", JSON.stringify(output.parseTime));
  hdom.setElementText("info-num-passes", JSON.stringify(output.passes));

  const div = hdom.getElement("info-plugin-times-content");
  hdom.removeChildren(div);
  if (pluginTimes.size) {
    const entries = Array.from(pluginTimes.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    const maxTime = entries[0][1];
    const totalPluginTime = entries.reduce((time, entry) => time + entry[1], 0);
    for (const entry of entries) {
      div.appendChild(hdom.createTextElement("div", {}, entry[0]));
      const timeDiv = hdom.createElement("div");
      const histoBar = hdom.createElement("span", {
        class: "histobar",
        style: `width:${(entry[1] * 100) / maxTime}%`,
      });
      histoBar.appendChild(
        hdom.createTextElement(
          "span",
          {
            class: "histopct",
          },
          (entry[1] / totalPluginTime).toLocaleString(undefined, {
            style: "percent",
            minimumFractionDigits: 2,
          }),
        ),
      );
      histoBar.appendChild(
        document.createTextNode(` - ${entry[1].toString()} ms`),
      );
      timeDiv.appendChild(histoBar);
      div.appendChild(timeDiv);
    }
  }
}
