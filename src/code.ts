import { bulk } from "./bulk";
import {
  getCodegenResultsFromPluginData,
  setCodegenResultsInPluginData,
} from "./pluginData";
import { paramsFromNode } from "./params";
import { nodeSnippetTemplateDataArrayFromNode } from "./snippets";

if (figma.mode === "codegen") {
  initializeCodegenMode();
} else {
  initializeDesignMode();
}

/**
 * In codegen mode (running in Dev Mode), the plugin returns codegen,
 *  and can also open a UI "editor" for managing snippet templates.
 */
function initializeCodegenMode() {
  /**
   * The preferences change event is fired when settings change from the codegen settings menu.
   * We only respond to this event when the user selects "Open Editor"
   * This is configured in manifest.json "codegenPreferences" as the "editor" action.
   */
  figma.codegen.on("preferenceschange", async (event) => {
    if (event.propertyName === "editor") {
      openCodeSnippetEditorUI();
    }
  });

  /**
   * Whenever we receive a message from the UI in codegen mode, it is either:
   *  - INITIALIZE: requesting initial data about the current selection when it opens
   *  - SAVE: providing template data for the plugin to save on the current selection
   */
  figma.ui.on("message", async (event: EventFromEditor) => {
    if (event.type === "INITIALIZE") {
      handleCurrentSelection();
    } else if (event.type === "SAVE") {
      setCodegenResultsInPluginData(figma.currentPage.selection[0], event.data);
    } else {
      console.log("UNKNOWN EVENT", event);
    }
  });

  /**
   * When the selection changes we want to rerun the code that handles a new node.
   */
  figma.on("selectionchange", () => handleCurrentSelection);

  /**
   * This is the main codegen event and expects us to resolve with a CodegenResult array
   */
  figma.codegen.on("generate", async () => {
    try {
      /**
       * Settings defined in manifest.json "codegenPreferences" for "details mode" and
       *   what to render when there is no template to render.
       * https://github.com/figma/code-snippet-editor-plugin#details-mode
       */
      const { detailsMode, defaultSnippet } =
        figma.codegen.preferences.customSettings;
      const isDetailsMode = detailsMode === "on";
      const hasDefaultMessage = defaultSnippet === "message";
      const currentNode = handleCurrentSelection();

      const paramsMap = await paramsFromNode(currentNode);
      const nodeSnippetTemplateDataArray =
        await nodeSnippetTemplateDataArrayFromNode(currentNode, paramsMap);

      const snippets = codegenResultsFromNodeSnippetTemplateDataArray(
        nodeSnippetTemplateDataArray,
        isDetailsMode
      );

      /**
       * In "Details mode" we render the params and raw params as code snippets
       * https://github.com/figma/code-snippet-editor-plugin#details-mode
       */
      if (isDetailsMode) {
        snippets.push({
          title: "Node Params",
          code: JSON.stringify(paramsMap.params, null, 2),
          language: "JSON",
        });
        snippets.push({
          title: "Node Params (Raw)",
          code: JSON.stringify(paramsMap.paramsRaw, null, 2),
          language: "JSON",
        });
      }

      /**
       * If there are no snippets and the default snippet setting is to show a mesage,
       *  add the message as a snippet.
       */
      if (!snippets.length && hasDefaultMessage) {
        snippets.push({
          title: "Snippets",
          code: "No snippets on this node. Add snippets via the Snippet Editor.",
          language: "PLAINTEXT",
        });
      }

      return snippets;
    } catch (e) {
      return [
        { language: "JSON", code: JSON.stringify(e, null, 2), title: "Error" },
      ];
    }
  });
}

/**
 * Running in design mode, we can perform bulk operations like import/export from JSON
 *   and helpers for loading node data and component data.
 */
function initializeDesignMode() {
  figma.ui.on("message", async (event: EventFromBulk) => {
    if (event.type === "INITIALIZE") {
      handleCurrentSelection();
    } else if (event.type === "COMPONENT_DATA") {
      bulk.performGetComponentData();
    } else if (event.type === "NODE_DATA") {
      await bulk.performGetNodeData();
    } else if (event.type === "EXPORT") {
      bulk.performExport();
    } else if (event.type === "IMPORT") {
      bulk.performImport(event.data);
    }
  });

  figma.showUI(__uiFiles__.bulk, {
    width: 600,
    height: 600,
    themeColors: true,
  });
}

/**
 * This attempts to open the editor UI in a large, but unobtrusive way.
 * Real important math right here (jk, totally arbitrary).
 */
function openCodeSnippetEditorUI() {
  const { x, y, width, height } = figma.viewport.bounds;
  const absWidth = width * figma.viewport.zoom;
  const absHeight = height * figma.viewport.zoom;
  const finalWidth = Math.round(
    Math.max(Math.min(absWidth, 400), Math.min(absWidth * 0.6, 700))
  );
  const finalHeight = Math.round(Math.min(absHeight, 600));
  const realX = x + Math.round(absWidth - finalWidth);
  figma.showUI(__uiFiles__.editor, {
    position: { x: realX, y },
    width: finalWidth,
    height: finalHeight,
    themeColors: true,
  });
}

/**
 * Final assembly of the codegen result that will include raw templates when in "details mode"
 * Can have additional things appended to it conditionally, but this yields the main snippet array.
 * https://github.com/figma/code-snippet-editor-plugin#details-mode
 * @param nodeSnippetTemplateDataArray the compiled codegen result array with the raw templates version
 * @param isDetailsMode "details mode" boolean setting value
 * @returns the final codegen result to render
 */
function codegenResultsFromNodeSnippetTemplateDataArray(
  nodeSnippetTemplateDataArray: NodeSnippetTemplateData[],
  isDetailsMode: boolean
) {
  const codegenResult: CodegenResult[] = [];
  nodeSnippetTemplateDataArray.forEach((nodeSnippetTemplateData) => {
    const { codegenResultArray, codegenResultRawTemplatesArray } =
      nodeSnippetTemplateData;
    /**
     * If details mode, interleave raw templates between rendered snippets
     * Otherwise, return the codegen result array by itself
     */
    if (isDetailsMode) {
      codegenResultArray.forEach((result, i) => {
        codegenResult.push(codegenResultRawTemplatesArray[i]);
        codegenResult.push(result);
      });
    } else {
      codegenResult.push(...codegenResultArray);
    }
  });
  return codegenResult;
}

/**
 * Whenever the selection changes, we want to send information to an open UI if one exists.
 * Using try/catch as a lazy version of open UI detection.
 * @returns currently selected node
 */
function handleCurrentSelection() {
  const node = figma.currentPage.selection[0];
  try {
    const nodePluginData = node ? getCodegenResultsFromPluginData(node) : null;
    const nodeId = node ? node.id : null;
    const nodeType = node ? node.type : null;
    const message: EventToEditor = {
      type: "SELECTION",
      nodeId,
      nodeType,
      nodePluginData,
    };
    figma.ui.postMessage(message);
    return node;
  } catch (e) {
    // no ui open. ignore this.
    return node;
  }
}
