/**
 * An object containing global template definitions.
 *  "components" is a map binding component keys to codegen result arrays.
 *  "types" is a map binding  NodeTypes to codegen result arrays.
 */
type CodeSnippetGlobalTemplates = {
  components?: CodegenResultTemplatesByComponentKey;
  types?: { [K in NodeType | "DEFAULT"]?: CodegenResult[] };
};

/**
 * An object of params to fill a snippet template where k is like "property.variant"
 */
type CodeSnippetParams = { [k: string]: string };

/**
 * An object of template specific params, only generated when template calls for it.
 */
type CodeSnippetParamsTemplateParams = {
  code: string;
  children?: CodeSnippetParamsMap[];
  svg?: string;
};

/**
 * A map of raw and normalized code snippet params objects. Keys are implicitly the same, values are formatted differently.
 */
type CodeSnippetParamsMap = {
  paramsRaw: CodeSnippetParams;
  params: CodeSnippetParams;
  template: {
    [templateId: string]: CodeSnippetParamsTemplateParams;
  };
};

/**
 * An transient object that can hold values by any component property type
 */
type ComponentPropValues = {
  [K in ComponentPropertyType]?: string | boolean;
};

/**
 * A map of ComponentPropValuesMaps where the key is a property name.
 * Used to see if properties with the same name exist but with different types.
 */
type ComponentPropValuesMap = {
  [k: string]: ComponentPropValues;
};

/**
 * All filters for string transformation
 * https://github.com/figma/code-snippet-editor-plugin#filters
 */
type SnippetStringFilter =
  | "hyphen"
  | "camel"
  | "constant"
  | "pascal"
  | "raw"
  | "snake";

interface NodeSnippetTemplateData {
  /**
   * CodegenResult containing hydrated snippets
   */
  codegenResultArray: CodegenResult[];
  /**
   * CodegenResult of raw templates to be returned supplementally in "details mode"
   * https://github.com/figma/code-snippet-editor-plugin#details-mode
   */
  codegenResultRawTemplatesArray: CodegenResult[];
}

/**
 * JSON format of codegen result where key is the component key and value is an array of CodegenResult templates
 */
type CodegenResultTemplatesByComponentKey = {
  [componentKey: string]: CodegenResult[];
};

/**
 * Object of components and component sets by key
 */
type ComponentsByComponentKey = {
  [componentKey: string]: ComponentNode | ComponentSetNode;
};

/**
 * Events coming in from the editor.html ui
 */
type EventFromEditor =
  | {
      type: "EDITOR_INITIALIZE";
    }
  | EventFromEditorSave;
type EventFromEditorSave = {
  type: "EDITOR_SAVE";
  data: CodegenResult[];
};
/**
 * Events sending to the editor.html ui
 */
type EventToEditor = {
  type: "EDITOR_SELECTION";
  nodeId: string | null;
  nodeType: SceneNode["type"] | null;
  nodePluginData: CodegenResult[] | null;
};

/**
 * Events coming in from the templates.html ui
 */
type EventFromTemplates =
  | { type: "TEMPLATES_LOAD" | "TEMPLATES_ATOB" | "TEMPLATES_BTOA" }
  | EventFromTemplatesData;
type EventFromTemplatesData = {
  type: "TEMPLATES_DATA";
  data: CodeSnippetGlobalTemplates;
  dataEncodedString?: string;
  saveToTeamLibrary?: boolean;
};
/**
 * Events sending to the tempaltes.html ui
 */
type EventToTemplates = {
  type: "TEMPLATES_INITIALIZE";
  templates: CodeSnippetGlobalTemplates | {};
  enableTeamLibraries: boolean;
};

/**
 * Events coming in from the bulk.html ui
 */
type EventFromBulk =
  | {
      type: "BULK_INITIALIZE" | "BULK_EXPORT";
    }
  | EventFromBulkImport;

type EventFromBulkImport = {
  type: "BULK_IMPORT";
  data: CodegenResultTemplatesByComponentKey;
};

/**
 * Events sending to the bulk.html ui
 */
type EventToBulk = {
  type: "BULK_EXPORT";
  code: string;
};
