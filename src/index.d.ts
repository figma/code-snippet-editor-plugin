/**
 * An object of params to fill a snippet template where k is like "property.variant"
 */
type CodeSnippetParams = { [k: string]: string };

/**
 * A map of raw and normalized code snippet params objects. Keys are implicitly the same, values are formatted differently.
 */
type CodeSnippetParamsMap = {
  paramsRaw: CodeSnippetParams;
  params: CodeSnippetParams;
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
   */
  codegenResultRawTemplatesArray: CodegenResult[];
}

/**
 * JSON format of bulk codegen result payload for bulk import and export
 * Where key is the component key and value is an array of codegenResultTemplates
 */
type CodegenResultTemplatesByComponentKey = {
  [k: string]: CodegenResult[];
};

/**
 * JSON format of bulk component export result payload for bulk import and export
 * Where key is the component key and value is an array of codegenResultTemplates
 */
type ComponentDataByComponentKey = {
  [k: string]: { name: string; description: string; lineage: string };
};

/**
 * Object of components and component sets by key
 */
type ComponentsByComponentKey = {
  [k: string]: ComponentNode | ComponentSetNode;
};
