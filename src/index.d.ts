type CodeSnippetParams = { [k: string]: string };
type CodeSnippetParamsMap = {
  raw: CodeSnippetParams;
  params: CodeSnippetParams;
};

interface PluginDataAndParams {
  codeArray: string[];
  pluginDataArray: CodegenResult[];
  nodeType: string;
}
