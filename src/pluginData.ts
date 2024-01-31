const PLUGIN_DATA_NAMESPACE = "codesnippets";
const PLUGIN_DATA_KEY = "snippets";

export function getPluginData(node: BaseNode) {
  return node.getSharedPluginData(PLUGIN_DATA_NAMESPACE, PLUGIN_DATA_KEY);
}
export function setPluginData(node: BaseNode, data: string) {
  return node.setSharedPluginData(PLUGIN_DATA_NAMESPACE, PLUGIN_DATA_KEY, data);
}
