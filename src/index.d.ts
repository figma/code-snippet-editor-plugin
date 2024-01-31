type CodeSnippetParams = { [k: string]: string };
type CodeSnippetParamsMap = {
  paramsRaw: CodeSnippetParams;
  params: CodeSnippetParams;
};

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
