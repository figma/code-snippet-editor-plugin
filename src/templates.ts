import { getCodegenResultsFromPluginData } from "./pluginData";

const CLIENT_STORAGE_GLOBAL_TEMPLATES_KEY = "global-templates";
const TEMPLATE_VARIABLE_COLLECTION_NAME =
  "Code Snippet Editor Global Templates";

/**
 * Type safety function to indicate if item in clientStorage is CodeSnippetGlobalTemplates or not.
 * @param templates item in question
 * @returns whether or not the argument is CodeSnippetGlobalTemplates
 */
function templatesIsCodeSnippetGlobalTemplates(
  templates: CodeSnippetGlobalTemplates | any
): templates is CodeSnippetGlobalTemplates {
  if (typeof templates === "object" && !Array.isArray(templates)) {
    const keys = Object.keys(templates);
    if (keys.find((k) => k !== "components" && k !== "types")) {
      return false;
    }
    return true;
  }
  return false;
}

function atob(string: string): Promise<string> {
  return new Promise((resolve, reject) => {
    figma.ui.on("message", (e) =>
      e.type === "TEMPLATES_ATOB" ? resolve(e.data) : null
    );
    figma.showUI(
      `<script>parent.postMessage({ pluginMessage: { type: "TEMPLATES_ATOB", data: atob("${string}") } }, "*");</script>`,
      { visible: false }
    );
  });
}

function btoa(string: string): Promise<string> {
  return new Promise((resolve, reject) => {
    figma.ui.on("message", (e) =>
      e.type === "TEMPLATES_BTOA" ? resolve(e.data) : null
    );
    figma.showUI(
      `<script>parent.postMessage({ pluginMessage: { type: "TEMPLATES_BTOA", data: btoa("${string}") } }, "*");</script>`,
      { visible: false }
    );
  });
}

export async function getGlobalTemplates(): Promise<CodeSnippetGlobalTemplates | null> {
  const templates = (await getGlobalTemplatesFromClientStorage()) || {};
  // const collectionsFromTeamLibraries =
  //   await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  // const collection = collectionsFromTeamLibraries.find(
  //   (collection) => collection.name === TEMPLATE_VARIABLE_COLLECTION_NAME
  // );
  // if (collection) {
  //   const libraryVariables =
  //     await figma.teamLibrary.getVariablesInLibraryCollectionAsync(
  //       collection.key
  //     );
  //   const variableTemplates = await atob(libraryVariables[0].name);
  //   if (variableTemplates) {
  //     const json = JSON.parse(variableTemplates);
  //     templates.types = json.types;
  //   }
  // }
  return templates;
}

/**
 * Finding global templates stored on the current page
 * https://www.figma.com/plugin-docs/api/figma-clientStorage
 * @returns Promise resolving CodeSnippetGlobalTemplates object or null
 */
export async function loadTemplatesFromPage(): Promise<CodeSnippetGlobalTemplates | null> {
  const templates = (await getGlobalTemplatesFromClientStorage()) || {};
  templates.types = {};
  figma.currentPage.children.forEach((node) => {
    const result = getCodegenResultsFromPluginData(node);
    if (templates.types && result.length) {
      templates.types[node.name as NodeType] = result;
    }
  });
  if (
    Object.keys(templates.components || {}).length ||
    Object.keys(templates.types).length
  ) {
    return templates;
  } else {
    return null;
  }
}

/**
 * Finding global templates stored in figma clientStorage
 * https://www.figma.com/plugin-docs/api/figma-clientStorage
 * @returns Promise resolving CodeSnippetGlobalTemplates object or null
 */
export async function getGlobalTemplatesFromClientStorage(): Promise<CodeSnippetGlobalTemplates | null> {
  const templates = await figma.clientStorage.getAsync(
    CLIENT_STORAGE_GLOBAL_TEMPLATES_KEY
  );
  return templates && templatesIsCodeSnippetGlobalTemplates(templates)
    ? templates
    : null;
}

/**
 * Saving templates in client storage.
 * @param templates CodeSnippetGlobalTemplates object to save in figma clientStorage
 * @returns Promise resolve void
 */
export async function setGlobalTemplatesInClientStorage(
  templates: CodeSnippetGlobalTemplates
): Promise<void> {
  await figma.clientStorage.setAsync(
    CLIENT_STORAGE_GLOBAL_TEMPLATES_KEY,
    templates
  );
  return;
}

/**
 * Example templates you could import directly via the plugin.
 */
const templatesExamples: CodeSnippetGlobalTemplates = {
  components: {},
  types: {
    FRAME: [
      {
        title: "React",
        language: "JAVASCRIPT",
        code: `<Grid 
  direction="{{autolayout.layoutMode}}"
  padding=\{{ 
    {{?variables.paddingTop}}top: theme.{{variables.paddingTop|camel}},
    {{!variables.paddingTop}}top: {{autolayout.paddingTop}},
    {{?variables.paddingRight}}right: theme.{{variables.paddingRight|camel}},
    {{!variables.paddingRight}}right: {{autolayout.paddingRight}},
    {{?variables.paddingBottom}}bottom: theme.{{variables.paddingBottom|camel}},
    {{!variables.paddingBottom}}bottom: {{autolayout.paddingBottom}},
    {{?variables.paddingLeft}}left: theme.{{variables.paddingLeft|camel}},
    {{!variables.paddingLeft}}left: {{autolayout.paddingLeft}},
  }}
  {{?variables.itemSpacing}}gap={theme.{{variables.itemSpacing|camel}}}
  {{!variables.itemSpacing}}gap={{{autolayout.itemSpacing}}}
  {{?autolayout.layoutMode=horizontal}}verticalAlign="{{autolayout.counterAxisAlignItems}}"
  {{!autolayout.layoutMode=horizontal}}verticalAlign="{{autolayout.primaryAxisAlignItems}}"
  {{?autolayout.layoutMode=horizontal}}horizontalAlign="{{autolayout.primaryAxisAlignItems}}"
  {{!autolayout.layoutMode=horizontal}}horizontalAlign="{{autolayout.counterAxisAlignItems}}"
>
  {{figma.children}}
</Grid>`,
      },
    ],
    TEXT: [
      {
        title: "React",
        language: "JAVASCRIPT",
        code: `<Typography\\
variant="{{node.textStyle}}"\\
{{!node.textStyle}}variant="unknown"\\
\\>{{node.characters|raw}}</Typography>`,
      },
    ],
  },
};
