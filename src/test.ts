import { hydrateSnippets } from "./snippets";

const SNIPPET_TEST_PARAMS = {
  hello: "world",
  1: "1",
  2: "2",
};
const SNIPPET_TESTS = {
  "{{hello}}": "world",
  "\\{{escaped}}": "{{escaped}}",
  "{{?1=1&2=2}}1and2": "1and2",
  "{{?1=1|2=3}}1": "1",
  "{{?1=2|2=3}}1or2": "",
  "{{!1=1}}not1": "",
  "{{!1=2}}not1": "not1",
  "{{?1=1&2=2}}{{!hello=cheese}}compound": "compound",
};

const SNIPPET_TEST_CODE = Object.keys(SNIPPET_TESTS).join("\n");
const SNIPPET_TEST_CODE_EXPECTATION = Object.values(SNIPPET_TESTS)
  .filter(Boolean) // empty string wont render
  .join("\n");

async function test() {
  try {
    await testSnippets();
    return "Tests succeed!";
  } catch (e) {
    throw e;
  }
}

async function testSnippets() {
  const result = await hydrateSnippets(
    [{ language: "PLAINTEXT", code: SNIPPET_TEST_CODE, title: "test" }],
    { params: SNIPPET_TEST_PARAMS, paramsRaw: SNIPPET_TEST_PARAMS },
    "INSTANCE"
  );
  const code = result.codegenResultArray[0].code;
  if (code === SNIPPET_TEST_CODE_EXPECTATION) {
    return true;
  }
  throw `Snippet hydration broken. Got: "${code}"`;
}

test().then(console.log).catch(console.error);
