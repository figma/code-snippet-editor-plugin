const PLUGIN_DATA_NAMESPACE = "codesnippets";
const PLUGIN_DATA_KEY = "snippets";

/**
 * A list of valid codegen result languages
 */
const CODEGEN_LANGUAGES: CodegenResult["language"][] = [
  "BASH",
  "CPP",
  "CSS",
  "GO",
  "GRAPHQL",
  "HTML",
  "JAVASCRIPT",
  "JSON",
  "KOTLIN",
  "PLAINTEXT",
  "PYTHON",
  "RUBY",
  "RUST",
  "SQL",
  "SWIFT",
  "TYPESCRIPT",
];

/**
 * Find a CodegenResult[] in pluginData if it exists.
 * @param node the node to check pluginData on
 * @returns CodegenResult[] or empty array if none exist in pluginData.
 */
export function getCodegenResultsFromPluginData(
  node: BaseNode
): CodegenResult[] {
  const pluginData = node.getSharedPluginData(
    PLUGIN_DATA_NAMESPACE,
    PLUGIN_DATA_KEY
  );
  return pluginDataStringAsValidCodegenResults(pluginData) || [];
}

/**
 * Save a CodegenResult[] to pluginData on a node
 * @param node the node to save to
 * @param codegenResultArray the CodegenResult[] to save
 * @returns void;
 */
export function setCodegenResultsInPluginData(
  node: BaseNode,
  codegenResultArray: any
) {
  if (node && arrayContainsCodegenResults(codegenResultArray))
    return node.setSharedPluginData(
      PLUGIN_DATA_NAMESPACE,
      PLUGIN_DATA_KEY,
      JSON.stringify(codegenResultArray)
    );
}

/**
 * Type safety function to return if the argument "value" is a valid CodegenResult["language"]
 * @param value the value to validate
 * @returns whether or not the value is a CodegenResult["language"]
 */
function valueIsCodegenLanguage(
  value: any
): value is CodegenResult["language"] {
  return CODEGEN_LANGUAGES.includes(value as CodegenResult["language"]);
}

/**
 * Type safety function that validates if an object is a CodegenResult object
 * @param object the object to validate
 * @returns whether or not the object is a CodegenResult
 */
function objectIsCodegenResult(object: Object): object is CodegenResult {
  if (typeof object !== "object") return false;
  if (Object.keys(object).length !== 3) return false;
  if (!("title" in object && "code" in object && "language" in object))
    return false;
  if (typeof object.title !== "string" || typeof object.code !== "string")
    return false;
  return valueIsCodegenLanguage(object.language);
}

/**
 * Type safety function that validates if an array is an array of CodeResult objects
 * @param array the array to validate
 * @returns whether or not the array is a CodegenResult[]
 */
function arrayContainsCodegenResults(array: any): array is CodegenResult[] {
  let valid = true;
  if (Array.isArray(array)) {
    array.forEach((object) => {
      if (!objectIsCodegenResult(object)) {
        valid = false;
      }
    });
  } else {
    valid = false;
  }
  return valid;
}

/**
 * Given a JSON string from pluginData, return a valid CodegenResult[] or null if string is invalid
 * @param pluginDataString the string that may or may not be a JSON-stringified CodegenResult[]
 * @returns CodegenResult[] or null
 */
function pluginDataStringAsValidCodegenResults(
  pluginDataString: string
): CodegenResult[] | null {
  if (!pluginDataString) return null;
  try {
    const parsed = JSON.parse(pluginDataString);
    return arrayContainsCodegenResults(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}
