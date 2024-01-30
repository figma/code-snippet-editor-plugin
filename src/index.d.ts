type CodeSnippetParams = { [k: string]: string };
type CodeSnippetParamsMap = {
  raw: CodeSnippetParams;
  params: CodeSnippetParams;
};

type SnippetStringFilter =
  | "hyphen"
  | "camel"
  | "constant"
  | "pascal"
  | "raw"
  | "snake";

interface SnippetData {
  codeArray: string[];
  pluginDataArray: CodegenResult[];
  nodeType: string;
}
