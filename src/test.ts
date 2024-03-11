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
  "{{figma.children}}": "",
  "Hello, {{figma.children}}": "",
  "{{1}}{{hello}}{{2}}": "1world2",
  "{{1}}{{invalid}}{{2}}": "",
};

const SNIPPET_TEST_CODE = Object.keys(SNIPPET_TESTS).join("\n");
const SNIPPET_TEST_CODE_EXPECTATION = Object.values(SNIPPET_TESTS)
  .filter(Boolean) // empty string wont render
  .join("\n");

async function test() {
  try {
    await testSnippets();
    await recursiveTest();
    return "Tests succeed!";
  } catch (e) {
    throw e;
  }
}

async function testSnippets() {
  const result = await hydrateSnippets(
    [{ language: "PLAINTEXT", code: SNIPPET_TEST_CODE, title: "test" }],
    {
      params: SNIPPET_TEST_PARAMS,
      paramsRaw: SNIPPET_TEST_PARAMS,
      template: {},
    },
    "INSTANCE",
    "",
    0,
    {}
  );
  const code = result.codegenResultArray[0].code;
  if (code === SNIPPET_TEST_CODE_EXPECTATION) {
    return true;
  }
  throw `Snippet hydration broken. Got: "${code}"`;
}

test().then(console.log).catch(console.error);

async function recursiveTest() {
  const params: CodeSnippetParamsMap = {
    params: {
      "node.name": "buttons-frame",
      "node.type": "frame",
      "node.children": "2",
      "css.display": "flex",
      "css.width": "400px",
      "css.padding":
        "var(--padding-spacious, 16px) var(--padding-comfortable, 12px)",
      "css.flexDirection": "column",
      "css.justifyContent": "center",
      "css.alignItems": "center",
      "css.gap": "var(--gap-lg, 16px)",
      "css.border": "2px solid #E0E0E0",
      "css.background": "var(--color-bg-subtle, #F0F0F0)",
      "variables.itemSpacing": "gap-lg",
      "variables.paddingLeft": "padding-comfortable",
      "variables.paddingTop": "padding-spacious",
      "variables.paddingRight": "padding-comfortable",
      "variables.paddingBottom": "padding-spacious",
      "variables.fills": "color-bg-subtle",
      "autolayout.layoutMode": "vertical",
      "autolayout.paddingLeft": "12",
      "autolayout.paddingRight": "12",
      "autolayout.paddingTop": "16",
      "autolayout.paddingBottom": "16",
      "autolayout.itemSpacing": "16",
      "autolayout.primaryAxisAlignItems": "center",
      "autolayout.counterAxisAlignItems": "center",
    },
    paramsRaw: {
      "node.name": "Buttons Frame",
      "node.type": "FRAME",
      "node.children": "2",
      "css.display": "flex",
      "css.width": "400px",
      "css.padding":
        "var(--padding-spacious, 16px) var(--padding-comfortable, 12px)",
      "css.flexDirection": "column",
      "css.justifyContent": "center",
      "css.alignItems": "center",
      "css.gap": "var(--gap-lg, 16px)",
      "css.border": "2px solid #E0E0E0",
      "css.background": "var(--color-bg-subtle, #F0F0F0)",
      "variables.itemSpacing": "gap/lg",
      "variables.paddingLeft": "padding/comfortable",
      "variables.paddingTop": "padding/spacious",
      "variables.paddingRight": "padding/comfortable",
      "variables.paddingBottom": "padding/spacious",
      "variables.fills": "color/bg-subtle",
      "autolayout.layoutMode": "VERTICAL",
      "autolayout.paddingLeft": "12",
      "autolayout.paddingRight": "12",
      "autolayout.paddingTop": "16",
      "autolayout.paddingBottom": "16",
      "autolayout.itemSpacing": "16",
      "autolayout.primaryAxisAlignItems": "CENTER",
      "autolayout.counterAxisAlignItems": "CENTER",
    },
    template: {
      "React-JAVASCRIPT": {
        code: '<Grid \n  direction="{{autolayout.layoutMode}}"\n  background={theme.{{variables.fills|camel}}}\n  padding=\\{{\\\n{{?variables.paddingTop}}top: theme.{{variables.paddingTop|camel}},\\\n{{!variables.paddingTop}}top: {{autolayout.paddingTop}},\\\n{{?variables.paddingRight}}right: theme.{{variables.paddingRight|camel}},\\\n{{!variables.paddingRight}}right: {{autolayout.paddingRight}},\\\n{{?variables.paddingBottom}}bottom: theme.{{variables.paddingBottom|camel}},\\\n{{!variables.paddingBottom}}bottom: {{autolayout.paddingBottom}},\\\n{{?variables.paddingLeft}}left: theme.{{variables.paddingLeft|camel}}\\\n{{!variables.paddingLeft}}left: {{autolayout.paddingLeft}}\\\n}}\n  {{?variables.itemSpacing}}gap={theme.{{variables.itemSpacing|camel}}}\n  {{!variables.itemSpacing}}gap={{{autolayout.itemSpacing}}}\n  {{?autolayout.layoutMode=horizontal}}verticalAlign="{{autolayout.counterAxisAlignItems}}"\n  {{!autolayout.layoutMode=horizontal}}verticalAlign="{{autolayout.primaryAxisAlignItems}}"\n  {{?autolayout.layoutMode=horizontal}}horizontalAlign="{{autolayout.primaryAxisAlignItems}}"\n  {{!autolayout.layoutMode=horizontal}}horizontalAlign="{{autolayout.counterAxisAlignItems}}"\n{{!figma.children}} />\n{{?figma.children}}>\n  {{figma.children}}\n{{?figma.children}}</Grid>',
        children: [
          {
            params: {
              "node.name": "heyo-look-at-this",
              "node.type": "text",
              "node.characters": "heyo-look-at-this",
              "node.textStyle": "heading-02",
              "css.color": "#000",
              "css.fontFamily": "Inter",
              "css.fontSize": "36px",
              "css.fontStyle": "normal",
              "css.fontWeight": "400",
              "css.lineHeight": "normal",
            },
            paramsRaw: {
              "node.name": "Heyo look at this",
              "node.type": "TEXT",
              "node.characters": "Heyo look at this",
              "node.textStyle": "Heading 02",
              "css.color": "#000",
              "css.fontFamily": "Inter",
              "css.fontSize": "36px",
              "css.fontStyle": "normal",
              "css.fontWeight": "400",
              "css.lineHeight": "normal",
            },
            template: {
              "React-JAVASCRIPT": {
                code: '<Typography\\\nvariant="{{node.textStyle}}"\\\n{{!node.textStyle}}variant="unknown"\\\n\\>{{node.characters|raw}}</Typography>',
              },
            },
          },
          {
            params: {
              "node.name": "frame-2",
              "node.type": "frame",
              "node.children": "2",
              "css.display": "flex",
              "css.justifyContent": "flex-end",
              "css.alignItems": "center",
              "css.gap": "var(--gap-md, 12px)",
              "variables.itemSpacing": "gap-md",
              "autolayout.layoutMode": "horizontal",
              "autolayout.paddingLeft": "0",
              "autolayout.paddingRight": "0",
              "autolayout.paddingTop": "0",
              "autolayout.paddingBottom": "0",
              "autolayout.itemSpacing": "12",
              "autolayout.primaryAxisAlignItems": "max",
              "autolayout.counterAxisAlignItems": "center",
            },
            paramsRaw: {
              "node.name": "Frame 2",
              "node.type": "FRAME",
              "node.children": "2",
              "css.display": "flex",
              "css.justifyContent": "flex-end",
              "css.alignItems": "center",
              "css.gap": "var(--gap-md, 12px)",
              "variables.itemSpacing": "gap/md",
              "autolayout.layoutMode": "HORIZONTAL",
              "autolayout.paddingLeft": "0",
              "autolayout.paddingRight": "0",
              "autolayout.paddingTop": "0",
              "autolayout.paddingBottom": "0",
              "autolayout.itemSpacing": "12",
              "autolayout.primaryAxisAlignItems": "MAX",
              "autolayout.counterAxisAlignItems": "CENTER",
            },
            template: {
              "React-JAVASCRIPT": {
                code: '<Grid \n  direction="{{autolayout.layoutMode}}"\n  background={theme.{{variables.fills|camel}}}\n  padding=\\{{\\\n{{?variables.paddingTop}}top: theme.{{variables.paddingTop|camel}},\\\n{{!variables.paddingTop}}top: {{autolayout.paddingTop}},\\\n{{?variables.paddingRight}}right: theme.{{variables.paddingRight|camel}},\\\n{{!variables.paddingRight}}right: {{autolayout.paddingRight}},\\\n{{?variables.paddingBottom}}bottom: theme.{{variables.paddingBottom|camel}},\\\n{{!variables.paddingBottom}}bottom: {{autolayout.paddingBottom}},\\\n{{?variables.paddingLeft}}left: theme.{{variables.paddingLeft|camel}}\\\n{{!variables.paddingLeft}}left: {{autolayout.paddingLeft}}\\\n}}\n  {{?variables.itemSpacing}}gap={theme.{{variables.itemSpacing|camel}}}\n  {{!variables.itemSpacing}}gap={{{autolayout.itemSpacing}}}\n  {{?autolayout.layoutMode=horizontal}}verticalAlign="{{autolayout.counterAxisAlignItems}}"\n  {{!autolayout.layoutMode=horizontal}}verticalAlign="{{autolayout.primaryAxisAlignItems}}"\n  {{?autolayout.layoutMode=horizontal}}horizontalAlign="{{autolayout.primaryAxisAlignItems}}"\n  {{!autolayout.layoutMode=horizontal}}horizontalAlign="{{autolayout.counterAxisAlignItems}}"\n{{!figma.children}} />\n{{?figma.children}}>\n  {{figma.children}}\n{{?figma.children}}</Grid>',
                children: [
                  {
                    params: {
                      "property.iconEnd.b": "false",
                      "property.iconEnd.i": "icon-refresh",
                      "property.iconStart.b": "false",
                      "property.iconStart.i": "icon-heart-solid",
                      "property.label": "cancel",
                      "property.variant": "inverse",
                      "property.state": "default",
                      "property.size": "small",
                      "node.name": "button",
                      "node.type": "instance",
                      "node.children": "1",
                      "component.key":
                        "7e95f3069ff381e6d1ea1e34d13d82045be8e249",
                      "component.type": "component-set",
                      "component.name": "button",
                      "css.display": "flex",
                      "css.padding":
                        "var(--padding-compact, 4px) var(--padding-spacious, 16px)",
                      "css.justifyContent": "center",
                      "css.alignItems": "center",
                      "css.gap": "var(--gap-sm, 8px)",
                      "css.borderRadius": "var(--size-24, 24px)",
                      "css.background": "var(--color-bg-default, #FFF)",
                      "variables.itemSpacing": "gap-sm",
                      "variables.paddingLeft": "padding-spacious",
                      "variables.paddingTop": "padding-compact",
                      "variables.paddingRight": "padding-spacious",
                      "variables.paddingBottom": "padding-compact",
                      "variables.topLeftRadius": "size-24",
                      "variables.topRightRadius": "size-24",
                      "variables.bottomLeftRadius": "size-24",
                      "variables.bottomRightRadius": "size-24",
                      "variables.fills": "color-bg-default",
                      "autolayout.layoutMode": "horizontal",
                      "autolayout.paddingLeft": "16",
                      "autolayout.paddingRight": "16",
                      "autolayout.paddingTop": "4",
                      "autolayout.paddingBottom": "4",
                      "autolayout.itemSpacing": "8",
                      "autolayout.primaryAxisAlignItems": "center",
                      "autolayout.counterAxisAlignItems": "center",
                    },
                    paramsRaw: {
                      "property.iconEnd.b": "false",
                      "property.iconEnd.i": "Icon Refresh",
                      "property.iconStart.b": "false",
                      "property.iconStart.i": "Icon Heart - Solid",
                      "property.label": "Cancel",
                      "property.variant": "Inverse",
                      "property.state": "Default",
                      "property.size": "Small",
                      "node.name": "Button",
                      "node.type": "INSTANCE",
                      "node.children": "1",
                      "component.key":
                        "7e95f3069ff381e6d1ea1e34d13d82045be8e249",
                      "component.type": "COMPONENT_SET",
                      "component.name": "Button",
                      "css.display": "flex",
                      "css.padding":
                        "var(--padding-compact, 4px) var(--padding-spacious, 16px)",
                      "css.justifyContent": "center",
                      "css.alignItems": "center",
                      "css.gap": "var(--gap-sm, 8px)",
                      "css.borderRadius": "var(--size-24, 24px)",
                      "css.background": "var(--color-bg-default, #FFF)",
                      "variables.itemSpacing": "gap/sm",
                      "variables.paddingLeft": "padding/spacious",
                      "variables.paddingTop": "padding/compact",
                      "variables.paddingRight": "padding/spacious",
                      "variables.paddingBottom": "padding/compact",
                      "variables.topLeftRadius": "size-24",
                      "variables.topRightRadius": "size-24",
                      "variables.bottomLeftRadius": "size-24",
                      "variables.bottomRightRadius": "size-24",
                      "variables.fills": "color/bg-default",
                      "autolayout.layoutMode": "HORIZONTAL",
                      "autolayout.paddingLeft": "16",
                      "autolayout.paddingRight": "16",
                      "autolayout.paddingTop": "4",
                      "autolayout.paddingBottom": "4",
                      "autolayout.itemSpacing": "8",
                      "autolayout.primaryAxisAlignItems": "CENTER",
                      "autolayout.counterAxisAlignItems": "CENTER",
                    },
                    template: {
                      "React-JAVASCRIPT": {
                        code: '<Button\n  {{?property.state=disabled}}disabled\n  {{!property.size=medium}}size="{{property.size}}"\n  variant="{{property.variant}}"\n  {{?property.iconStart.b=true}}iconStart={<{{property.iconStart.i|pascal}} />}\n  {{?property.iconEnd.b=true}}iconEnd={<{{property.iconEnd.i|pascal}} />}\n  onClick={() => {}}\n>\n  {{property.label|raw}}\n</Button>',
                      },
                    },
                  },
                  {
                    params: {
                      "property.iconEnd.b": "true",
                      "property.iconEnd.i": "icon-arrow-right",
                      "property.iconStart.b": "false",
                      "property.iconStart.i": "icon-heart-solid",
                      "property.label": "lets-go",
                      "property.variant": "secondary",
                      "property.state": "default",
                      "property.size": "medium",
                      "node.name": "button",
                      "node.type": "instance",
                      "node.children": "2",
                      "component.key":
                        "7e95f3069ff381e6d1ea1e34d13d82045be8e249",
                      "component.type": "component-set",
                      "component.name": "button",
                      "css.display": "flex",
                      "css.padding":
                        "var(--padding-default, 8px) var(--padding-baggy, 24px)",
                      "css.justifyContent": "center",
                      "css.alignItems": "center",
                      "css.gap": "var(--gap-sm, 8px)",
                      "css.borderRadius": "var(--size-24, 24px)",
                      "css.background":
                        "var(--color-bg-brand-secondary, #7900D5)",
                      "variables.itemSpacing": "gap-sm",
                      "variables.paddingLeft": "padding-baggy",
                      "variables.paddingTop": "padding-default",
                      "variables.paddingRight": "padding-baggy",
                      "variables.paddingBottom": "padding-default",
                      "variables.topLeftRadius": "size-24",
                      "variables.topRightRadius": "size-24",
                      "variables.bottomLeftRadius": "size-24",
                      "variables.bottomRightRadius": "size-24",
                      "variables.fills": "color-bg-brand-secondary",
                      "autolayout.layoutMode": "horizontal",
                      "autolayout.paddingLeft": "24",
                      "autolayout.paddingRight": "24",
                      "autolayout.paddingTop": "8",
                      "autolayout.paddingBottom": "8",
                      "autolayout.itemSpacing": "8",
                      "autolayout.primaryAxisAlignItems": "center",
                      "autolayout.counterAxisAlignItems": "center",
                    },
                    paramsRaw: {
                      "property.iconEnd.b": "true",
                      "property.iconEnd.i": "Icon Arrow - Right",
                      "property.iconStart.b": "false",
                      "property.iconStart.i": "Icon Heart - Solid",
                      "property.label": "Let's go!",
                      "property.variant": "Secondary",
                      "property.state": "Default",
                      "property.size": "Medium",
                      "node.name": "Button",
                      "node.type": "INSTANCE",
                      "node.children": "2",
                      "component.key":
                        "7e95f3069ff381e6d1ea1e34d13d82045be8e249",
                      "component.type": "COMPONENT_SET",
                      "component.name": "Button",
                      "css.display": "flex",
                      "css.padding":
                        "var(--padding-default, 8px) var(--padding-baggy, 24px)",
                      "css.justifyContent": "center",
                      "css.alignItems": "center",
                      "css.gap": "var(--gap-sm, 8px)",
                      "css.borderRadius": "var(--size-24, 24px)",
                      "css.background":
                        "var(--color-bg-brand-secondary, #7900D5)",
                      "variables.itemSpacing": "gap/sm",
                      "variables.paddingLeft": "padding/baggy",
                      "variables.paddingTop": "padding/default",
                      "variables.paddingRight": "padding/baggy",
                      "variables.paddingBottom": "padding/default",
                      "variables.topLeftRadius": "size-24",
                      "variables.topRightRadius": "size-24",
                      "variables.bottomLeftRadius": "size-24",
                      "variables.bottomRightRadius": "size-24",
                      "variables.fills": "color/bg-brand-secondary",
                      "autolayout.layoutMode": "HORIZONTAL",
                      "autolayout.paddingLeft": "24",
                      "autolayout.paddingRight": "24",
                      "autolayout.paddingTop": "8",
                      "autolayout.paddingBottom": "8",
                      "autolayout.itemSpacing": "8",
                      "autolayout.primaryAxisAlignItems": "CENTER",
                      "autolayout.counterAxisAlignItems": "CENTER",
                    },
                    template: {
                      "React-JAVASCRIPT": {
                        code: '<Button\n  {{?property.state=disabled}}disabled\n  {{!property.size=medium}}size="{{property.size}}"\n  variant="{{property.variant}}"\n  {{?property.iconStart.b=true}}iconStart={<{{property.iconStart.i|pascal}} />}\n  {{?property.iconEnd.b=true}}iconEnd={<{{property.iconEnd.i|pascal}} />}\n  onClick={() => {}}\n>\n  {{property.label|raw}}\n</Button>',
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    },
  };
  const template = `<Grid 
  direction="{{autolayout.layoutMode}}"
  background={theme.{{variables.fills|camel}}}
  padding=\\{{\\
{{?variables.paddingTop}}top: theme.{{variables.paddingTop|camel}},\\
{{!variables.paddingTop}}top: {{autolayout.paddingTop}},\\
{{?variables.paddingRight}}right: theme.{{variables.paddingRight|camel}},\\
{{!variables.paddingRight}}right: {{autolayout.paddingRight}},\\
{{?variables.paddingBottom}}bottom: theme.{{variables.paddingBottom|camel}},\\
{{!variables.paddingBottom}}bottom: {{autolayout.paddingBottom}},\\ 
{{?variables.paddingLeft}}left: theme.{{variables.paddingLeft|camel}}\\
{{!variables.paddingLeft}}left: {{autolayout.paddingLeft}}\\
}}
  {{?variables.itemSpacing}}gap={theme.{{variables.itemSpacing|camel}}}
  {{!variables.itemSpacing}}gap={{{autolayout.itemSpacing}}}
  {{?autolayout.layoutMode=horizontal}}verticalAlign="{{autolayout.counterAxisAlignItems}}"
  {{!autolayout.layoutMode=horizontal}}verticalAlign="{{autolayout.primaryAxisAlignItems}}"
  {{?autolayout.layoutMode=horizontal}}horizontalAlign="{{autolayout.primaryAxisAlignItems}}"
  {{!autolayout.layoutMode=horizontal}}horizontalAlign="{{autolayout.counterAxisAlignItems}}"
{{!figma.children}} />
{{?figma.children}}>
  {{figma.children}}
{{?figma.children}}</Grid>`;
  const expectation = `<Grid 
  direction="vertical"
  background={theme.colorBgSubtle}
  padding={{ top: theme.paddingSpacious, right: theme.paddingComfortable, bottom: theme.paddingSpacious, left: theme.paddingComfortable }}
  gap={theme.gapLg}
  verticalAlign="center"
  horizontalAlign="center"
>
  <Typography variant="heading-02">Heyo look at this</Typography>
  <Grid 
    direction="horizontal"
    padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
    gap={theme.gapMd}
    verticalAlign="center"
    horizontalAlign="max"
  >
    <Button
      size="small"
      variant="inverse"
      onClick={() => {}}
    >
      Cancel
    </Button>
    <Button
      variant="secondary"
      iconEnd={<IconArrowRight />}
      onClick={() => {}}
    >
      Let's go!
    </Button>
  </Grid>
</Grid>`;
  const result = await hydrateSnippets(
    [{ language: "JAVASCRIPT", code: template, title: "React" }],
    params,
    "FRAME",
    "",
    0,
    {}
  );
  const code = result.codegenResultArray[0].code;
  if (code === expectation) {
    return true;
  }
  const expectationLines = expectation.split("\n");
  const codeLines = code.split("\n");
  const diff: string[] = [];
  expectationLines.forEach((line, i) => {
    if (line !== codeLines[i]) {
      diff.push(["E: " + line, "R: " + codeLines[i]].join("\n"));
    }
  });
  throw `Snippet hydration broken.

${diff.join("\n\n")}
`;
}
