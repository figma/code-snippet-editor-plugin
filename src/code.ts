import {
  getCodegenResultsFromPluginData,
  setCodegenResultsInPluginData,
} from "./pluginData";
import { recursiveParamsFromNode } from "./params";
import { nodeSnippetTemplateDataArrayFromNode } from "./snippets";
import {
  getGlobalTemplatesFromClientStorage,
  getEncodedGlobalTemplatesFromTeamLibrary,
  setGlobalTemplatesInClientStorage,
  setGlobalTemplatesInTeamLibrary,
  loadTemplatesFromPage,
} from "./templates";

initializeUIMessageHandler();

if (figma.mode === "codegen") {
  initializeCodegenMode();
} else {
  openGlobalTemplateUI();
}

function initializeUIMessageHandler() {
  figma.ui.on(
    "message",
    async (event: EventFromEditor | EventFromTemplates) => {
      switch (event.type) {
        case "EDITOR_INITIALIZE":
          handleCurrentSelection();
          break;
        case "EDITOR_SAVE":
          setCodegenResultsInPluginData(
            figma.currentPage.selection[0],
            event.data
          );
          figma.notify("Saved to node!");
          break;
        case "TEMPLATES_SAVE":
          if (event.saveToTeamLibrary && event.dataEncodedString) {
            setGlobalTemplatesInTeamLibrary(event.dataEncodedString);
            figma.notify("Saved to team library!");
          } else {
            setGlobalTemplatesInClientStorage(event.data);
            figma.notify("Saved to client storage!");
          }
          const message: EventToTemplates = { type: "TEMPLATES_SAVE_RESULT" };
          figma.ui.postMessage(message);
          break;
        case "TEMPLATES_LOAD":
          if (event.loadFromTeamLibrary) {
            const templates = await getEncodedGlobalTemplatesFromTeamLibrary();
            const message: EventToTemplates = {
              type: "TEMPLATES_LOAD_TEAM_LIBRARY_RESULT",
              templates,
            };
            figma.ui.postMessage(message);
            if (!templates) {
              figma.notify("No templates defined in team library");
            }
          } else {
            const templates = await loadTemplatesFromPage();
            const message: EventToTemplates = {
              type: "TEMPLATES_LOAD_PAGE_RESULT",
              templates,
            };
            figma.ui.postMessage(message);
            if (!templates) {
              figma.notify("No templates defined on this page");
            }
          }
          break;
        default:
          console.log("UNKNOWN EVENT", event);
      }
    }
  );
}

/**
 * In codegen mode (running in Dev Mode), the plugin returns codegen,
 *  and can also open a UI "editor" for managing snippet templates.
 */
async function initializeCodegenMode() {
  /**
   * The preferences change event is fired when settings change from the codegen settings menu.
   * We only respond to this event when the user selects "Open Editor"
   * This is configured in manifest.json "codegenPreferences" as the "editor" action.
   */
  figma.codegen.on("preferenceschange", async (event) => {
    if (event.propertyName === "editor") {
      openCodeSnippetEditorUI();
    } else if (event.propertyName === "templates") {
      openGlobalTemplateUI();
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

      const templates = (await getGlobalTemplatesFromClientStorage()) || {};
      const recursiveParamsMap = await recursiveParamsFromNode(
        currentNode,
        templates
      );
      const nodeSnippetTemplateDataArray =
        await nodeSnippetTemplateDataArrayFromNode(
          currentNode,
          recursiveParamsMap,
          templates
        );

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
          title: "Params",
          code: JSON.stringify(recursiveParamsMap, null, 2),
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
    } catch (e: any) {
      console.error(e);
      return [
        {
          language: "PLAINTEXT",
          code: typeof e === "string" ? e : `${e}`,
          title: "Error",
        },
      ];
    }
  });
}

/**
 * This attempts to open the editor UI in a large, but unobtrusive way.
 * Real important math right here (jk, totally arbitrary).
 */
async function openCodeSnippetEditorUI() {
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
 * Opening the UI for global templates and sending a message with the initial template data
 */
async function openGlobalTemplateUI() {
  figma.showUI(__uiFiles__.templates, {
    width: 600,
    height: 600,
    themeColors: true,
  });
  const templates = (await getGlobalTemplatesFromClientStorage()) || {};
  sendTemplatesInitializeMessage(templates);
}

/**
 * Send the initialize message to the ui with templates, and indicator if library templates are available.
 * @param templates
 */
async function sendTemplatesInitializeMessage(
  templates: CodeSnippetGlobalTemplates
) {
  const hasLibraryTemplates = Boolean(
    await getEncodedGlobalTemplatesFromTeamLibrary()
  );
  const message: EventToTemplates = {
    type: "TEMPLATES_INITIALIZE",
    templates,
    hasLibraryTemplates,
    editorType: figma.editorType,
  };
  figma.ui.postMessage(message);
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
      type: "EDITOR_SELECTION",
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
