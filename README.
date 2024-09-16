![](./Code%20Snippet%20Editor%20Banner.png)

# Code Snippet Editor

Translate component variants, properties, and more into dynamic code snippets for your design system.

- [Overview](#overview)
- [Templating](#templating)
  - [Symbols](#symbols)
  - [Escaping](#escaping)
  - [Children](#children)
  - [Conditionals](#conditionals)
  - [Operators](#operators)
  - [Samples](#samples)
  - [Single Line Syntax](#single-line-syntax)
- [Params](#params)
  - [`autolayout`](#autolayout)
  - [`component`](#component)
  - [`css`](#css)
  - [`figma`](#figma)
  - [`node`](#node)
  - [`property`](#property)
  - [`variables`](#variables)
- [Filters](#filters)
- [Global Templates](#global-templates)
- [“Details mode”](#details-mode)
- [Bulk Operations](#bulk-operations)
- [Full Examples](#full-examples)
  - [React](#react)
  - [HTML/CSS](#htmlcss)

## Overview

This plugin allows you to write and generate code snippets for Figma nodes, which are rendered in the Inspect Panel in [Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode). You can make these code snippets dynamic, by referring to parameters provided by the plugin. Doing this for your component library will bring accurate code snippets to any project that incorporates your design system.

Snippet templates can represent code in any language. A JSX-style template for a main component like this:

```
<Button
  onClick={() => {}}
  variant="{{property.variant}}"
  size="{{property.size}}"
  iconEnd={<{{property.iconEnd|pascal}} />}
>
  {{property.label}}
</Button>
```

...when filled with a selected component instance's properties, will render an accurate code snippet in Figma like this:

```jsx
<Button
  onClick={() => {}}
  variant="primary"
  size="large"
  iconEnd={<IconArrowRight />}
>
  Hello World!
</Button>
```

Code snippets are saved in [shared plugin data](https://www.figma.com/plugin-docs/api/properties/nodes-setsharedplugindata/) using the keys `node.getSharedPluginData("codesnippets", "snippets")`. A benefit of shared plugin data is that any plugin can make use of or update these snippets.

You can add code snippets using the Snippet Editor, which is accessible from the settings menu of the plugin in Dev Mode's Inspect Panel:

![Screenshot 2023-12-04 at 10 14 46 PM](https://github.com/figma/code-snippet-editor-plugin/assets/57682038/5883b5bb-f97e-436d-b6ac-d0c4f2d410fd)

Any snippets added to a Component or ComponentSet will also be propagated to any Instances.

Snippets can either be static or utilize the snippet templating language, which is detailed below.

## Templating

Each line of a code snippet is individually evaluated. Lines of a snippet can include dynamic symbols or conditional statements that refer to parameters from the selected node in Figma. Template parameters are all treated like strings. There is no concept of primitives (number, boolean, etc) in this templating language.

### Symbols

Each line can feature one or more symbols, enclosed in curly brackets like `{{something}}`.

```
Hello {{something}}!
```

If `something` was defined as `"world"`, this would render `"Hello world!"`.

For a line to render, the appropriate data must be present. If `something` was not defined at all, the line would not render.

### Escaping

If you need to write the text `"{{something}}"` explicitly in your rendered code, you can escape that text with a single backslash prefix like `"\{{something}}"`.

A more realistic example is the Ember language which requires something like `<Button @label={{t "Value"}} />`. To achieve this, the template would escape the outer brackets with a single prefix. `<Button @label=\{{t "{{something}}"}} />`.

### Children

You may be interested in rendering nested component instances inside your template. `{{figma.children}}` is a special symbol that will render any immediate children inside the template.

These children must have snippet templates defined on themselves with the same title and language as the parent template.

Currently, `figma.children` only looks at immediate children, and will recurse up to 12 levels deep.

If you want to render something when there are no children, you can also refer to the [`"node.children"`](#node) param. `{{?node.children=0}}`.

Indentation for nested templates infers space or tab indents from the beginning of the line that calls `{{figma.children}}`. For example:

A parent node has the template...

```
<p>
  {{figma.children}}
</p>
```

...and one of its children has the template...

```
<span>
  Hello world!
</span>
```

...when the parent is selected, it would render...

```
<p>
  <span>
    Hello world!
  </span>
</p>
```

...and when child is selected, it would render...

```
<span>
  Hello world!
</span>
```

The two spaces prefixing the `  {{figma.children}}` on the parent template are how the template knows how far in to indent the span.

### Conditionals

Each line can start with a conditional statement. Conditionals do not render anything by themselves, they are logical ammendments to the line.

Conditionals can be either affirmative with a question mark `{{?something=yes}}`, or negative with an exclamation mark `{{!something=yes}}`. For a line to render, these statements must be validated.

You can also detect the presence of a property by omitting the equals sign and value. For example, `{{?something}}` and `{{!something}}` would be the affirmative and negative statement for the presence and absence of `something`.

```
{{?something}}something exists!
{{!something}}something does not exist!
{{?something=yes}}something is "yes"
{{!something=yes}}something is not "yes"
```

### Operators

While you can add multiple conditional statements to a single line, using an operator is often a better way to express logic. You can make "or" statements with `|`, as well as "and" statements with `&`.

For example, `{{?A=1}}{{?B=2}}` can also be expressed as `{{?A=1&B=2}}`.

```
{{?A=1&B=2}}A is "1" AND B is "2"
{{?A=1|B=2}}A is "1" OR B is "2"
{{!A=1&B=2}}A is NOT "1" AND B is NOT "2"
{{!A=1|B=2}}A is NOT "1" OR B is NOT "2"
{{?A=1|B=2|C=3}}A is "1" OR B is "2" OR C is "3"
```

You cannot combine "or" and "and" statements (eg. `A=1|B=2&C=3`). You can express them as separate conditional statements (eg.`{{?A=1|B=2}}{{?C=3}}`).

### Samples

Render `"hello"` if `property` exists.

```
{{?property}}hello
```

Render `"hello"` only if `property` is `"value"`.

```
{{?property=value}}hello
```

Only render the value of `property2` if `property1` is `"value"`. (Will not render if `property2` does not exist!)

```
{{?property1=value}}{{property2}}
```

Only render the value of `property` if it is not `"value"`.

```
{{!property=value}}{{property}}
```

#### switch/case

```
{{?property=a}}line 1
{{?property=b}}line 2
{{?property=c}}line 3
```

#### if/else

```
{{?property=a}}line 1
{{!property=a}}line 2
```

### Single Line Syntax

Multiple lines in a snippet template can be rendered as a single line (e.g., a list of CSS class names). The following would render `hello world`.

```
hello\
world
```

Single line syntax creates scenarios with trailing and leading spaces that may not be desirable. For example...

```
"\
hello\
world\
"
```

...renders as `" hello world "` with an extra space at the beginning and end.

To remove a leading or trailing space, you can prefix or suffix an extra `\`.

```
"\\
hello\
world\
\"
```

This would yield `"hello world"` due to the extra trailing slash on line one and leading slash on line four.

## Params

The values you can refer to in symbols and conditional statements are called "params". These parameters are formatted as `prefix.param`.

> Enable ["Details mode"](#details-mode) to see all the params available for your selection!

> All param values are strings.

### `autolayout`

The detected [`InferredAutoLayout`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/) properties. Currently limited to
[`layoutMode`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#layoutmode), [`layoutWrap`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#layoutwrap), [`paddingLeft`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingleft), [`paddingRight`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingright), [`paddingTop`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingtop), [`paddingBottom`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingbottom), [`itemSpacing`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#itemspacing), [`counterAxisSpacing`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#counteraxisspacing), [`primaryAxisAlignItems`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#primaryaxisalignitems), and [`counterAxisAlignItems`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#counteraxisalignitems)

```json
{
  "autolayout.layoutMode": "vertical",
  "autolayout.paddingLeft": "10",
  "autolayout.paddingRight": "10",
  "autolayout.paddingTop": "20",
  "autolayout.paddingBottom": "20",
  "autolayout.itemSpacing": "10",
  "autolayout.primaryAxisAlignItems": "center",
  "autolayout.counterAxisAlignItems": "center"
}
```

### `component`

Contains data for the primary Component / ComponentSet. This is the "topmost" component node (which would have the component property definitions on it). For ComponentSets, variant Components, or their Instances, this will be the ComponentSet's key, type, and name. Any other Component and Instance will be the main Component.

```json
{
  "component.key": "8bf1e25fb834ff1ab666c69a08da1cd555746731",
  "component.type": "component",
  "component.name": "icon-heart"
}
```

### `css`

Contains output from [`node.getCSSAsync()`](https://www.figma.com/plugin-docs/api/ComponentNode/#getcssasync). Any CSS returned by the Figma API will be here with the `css.*` prefix.

```json
{
  "css.width": "24px",
  "css.height": "24px"
}
```

### `figma`

`figma` is not expressed as values in the params object, but rather as the name space for special symbols. Currently [`figma.children`](#children) is the only symbol in this namespace.

### `node`

Contains the name, type, and child count (when applicable) for the selected node. If a Component or ComponentSet, `node.key` will also be provided.

```json
{
  "node.name": "icon-heart",
  "node.type": "instance",
  "node.children": "0"
}
```

For text nodes, `node.characters` will be available. When text styles are applied to the node, `node.textStyle` will be present. Mixed text styles will have a value of [`"figma.mixed"`](https://www.figma.com/plugin-docs/api/properties/figma-mixed/).

```json
{
  "node.characters": "hello world",
  "node.textStyle": "heading-01"
}
```

### `property`

If the current node is a Component/Instance containing component properties, these will be under the `property.*` params namespace. A basic button component might look like this:

```json
{
  "property.hasIconStart": "true",
  "property.iconStart": "icon-check",
  "property.hasIconEnd": "false",
  "property.iconEnd": "placeholder",
  "property.label": "hello-world",
  "property.variant": "primary",
  "property.state": "default"
}
```

If properties share normalized names, their types will be suffixed with `*.` followed by the first letter of the type lowercased (`i` for instance swap, `b` for boolean, `t` for text, `v` for variant). For instance:

```json
{
  "property.iconStart.b": "true",
  "property.iconStart.i": "icon-check",
  "property.iconEnd.b": "false",
  "property.iconEnd.i": "placeholder"
}
```

> If more than one property of the same type share a normalized name, only one value will be available.

### `variables`

The [`boundVariables`](https://www.figma.com/plugin-docs/api/FrameNode/#boundvariables) on the current node.

```json
{
  "variables.itemSpacing": "spacing/spacing-sm"
}
```

If variables have a [codeSyntax](https://www.figma.com/plugin-docs/api/CodeSyntaxPlatform/), they are represented in addition to the raw name as the first initial of the syntax platform (`WEB`, `ANDROID`, and `iOS` are represented as `variables.*.w`, `variables.*.a`, and `variables.*.i`). For example, a node with a `itemSpacing` bound to a variable named `spacing/spacing-sm` which has a `WEB` codeSyntax set to `--spacing-sm` would have the following "raw" values:

```json
{
  "variables.itemSpacing": "spacing/spacing-sm",
  "variables.itemSpacing.w": "--spacing-sm"
}
```

## Filters

All strings can be filtered into different cases. The default filter is lowercased hyphenation.

The available filters are `raw`, `pascal`, `camel`, `snake`, `hyphen` (default), `constant` and referenced with a pipe `|`.

All filters except for `raw`, will strip non-alphanumeric characters from a string and treat them like a space.

If `node.name` was "Figma is great!", the following template...

```
{{node.name}}
{{node.name|raw}}
{{node.name|pascal}}
{{node.name|camel}}
{{node.name|snake}}
{{node.name|hyphen}}
{{node.name|constant}}
```

...would yield

```
figma-is-great
Figma is great!
FigmaIsGreat
figmaIsGreat
figma_is_great
figma-is-great
FIGMA_IS_GREAT
```

## Global Templates

Templates can also be stored in Figma's [clientStorage](https://www.figma.com/plugin-docs/api/figma-clientStorage/). This is the only way to store templates for non-component nodes in a way that all nodes can inherit them.

These templates are stored in an object with the following schema:

```json
{
  "types": {
    "FRAME": [
      {
        "title": "Sample",
        "language": "HTML",
        "code": "<p>Hello world! {{node.name}}</p>"
      }
    ]
  },
  "components": {
    "componentKeyABC123": [
      {
        "title": "Sample React",
        "language": "JAVASCRIPT",
        "code": "<MyComponent />"
      }
    ]
  }
}
```

Check out [./src/index.d.ts](./src/index.d.ts) for documentation on the `CodeSnippetGlobalTemplates` type.

See [./examples.json](./examples.json) for real world examples.

> Important: Figma's client storage is local to the user, device, and Figma context. If you save global templates in the Figma app and then open Figma in the web browser, the templates will not be available.

Syncing this JSON exernally is on the roadmap, but for now, the only way to add global templates is to select "Open Global Template Editor" from the plugin settings menu, paste the JSON into the text box, and hit save.

![Selecting "Open Global Template Editor" from the plugin settings menu](https://github.com/figma/code-snippet-editor-plugin/assets/97200987/70c56ee9-1b02-4a45-9ce5-55301a6578c3)

![Global Template Editor UI](https://github.com/figma/code-snippet-editor-plugin/assets/97200987/09d04b40-59f7-43c4-b878-40b319e98c23)

## “Details Mode”

Details mode can be enabled from the plugin settings menu.

In addition to the current snippets, it will display any templates being referenced, as well as JSON view of all the [params](#params) available for the current selection.

Details mode is really useful when you’re building or debuigging your templates!

## Bulk Operations

Running the plugin in design mode will open a window allowing you to perform bulk operations.

You can bulk export and import templates for the current file (currently only available for components and component sets).

The JSON schema for import and export is:

```ts
type Templates = {
  [k: ComponentKey]: Array<{
    language: CodegenResultLanguage;
    code: string;
    title: string;
  }>;
};
```

> More info: [CodegenResult languages](https://www.figma.com/plugin-docs/api/CodegenResult/), [Component key](https://www.figma.com/plugin-docs/api/ComponentNode/#key)

As an example:

```json
{
  "componentKeyABC123": [
    {
      "language": "JAVASCRIPT",
      "code": "<Button\n  {{?property.state = disabled}}disabled\n  variant=\"{{property.variant}}\"\n  {{?property.iconStart.b=true}}iconStart={<{{property.iconStart.i|pascal}} />}\n  {{?property.iconEnd.b=true}}iconEnd={<{{property.iconEnd.i|pascal}} />}\n  onClick={() => {}}\n>\n  {{property.label|raw}}\n</Button>",
      "title": "My Special Template"
    }
  ],
  "componentKeyDEF456": []
}
```

When importing, if the component key is present in the current file, its templates will be overwritten.

Importing an empty array for a component key will remove all snippets for that component.

Components whose keys are not definied in the JSON are not effected by an import, even if they have snippets defined in Figma.

## Full Examples

### React

The following template...

```
<Button
  {{!property.state=disabled}}not-disabled
  {{?property.state=disabled}}disabled
  variant="{{property.variant}}"
  {{?property.iconStart.b=true}}iconStart={<{{property.iconStart.i|pascal}} />}
  {{?property.iconEnd.b=true}}iconEnd={<{{property.iconEnd.i|pascal}} />}
  onClick={() => {}}
>
  {{property.label|raw}}
</Button>
```

...filled with these properties...

```json
{
  "property.iconStart.b": "true",
  "property.iconStart.i": "icon-check",
  "property.iconEnd.b": "false",
  "property.iconEnd.i": "placeholder",
  "property.label": "hello-world!",
  "property.variant": "primary",
  "property.state": "default"
}
```

...would render this snippet:

```jsx
<Button
  not-disabled
  variant="primary"
  iconStart={<IconCheck />}
  onClick={() => {}}
>
  Hello World!
</Button>
```

### HTML/CSS

The following template...

```
<button
  {{?property.state=disabled}}disabled
  type="button"
  class="\\
button\
{{!property.variant=primary}}button-{{property.variant}}\
{{!property.size=md}}button-size-{{property.size}}\
\"
>
  {{property.label|raw}}
</button>
```

...filled with these properties...

```json
{
  "property.label": "hello-world!",
  "property.variant": "secondary",
  "property.size": "lg",
  "property.state": "default"
}
```

...would render this snippet.

```
<button
  type="button"
  class="button button-secondary button-size-lg"
>
  Hello World!
</button>
```

...and when filled with these properties...

```json
{
  "property.label": "hello-world",
  "property.variant": "primary",
  "property.size": "md",
  "property.state": "disabled"
}
```

...would render this snippet.

```
<button
  disabled
  type="button"
  class="button"
>
  Hello World!
</button>
```
