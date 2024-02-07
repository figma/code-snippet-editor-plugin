export const templates: CodeSnippetGlobalTemplates = {
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
