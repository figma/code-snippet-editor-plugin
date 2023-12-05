# Code Snippet Editor

Translate component variants, properties, and more into dynamic code snippets for your design system.

- [Overview](#overview)
- [Templating](#templating)
  - [Symbols](#symbols)
  - [Qualifiers](#qualifiers)
  - [Samples](#samples)
  - [Single Line Syntax](#single-line-syntax)
- [Params](#params)
  - [`autolayout`](#autolayout)
  - [`component`](#component)
  - [`css`](#css)
  - [`node`](#node)
  - [`property`](#property)
  - [`variables`](#variables)
- [Filters](#filters)
- [“Details mode”](#details-mode)
- [Bulk Operations](#bulk-operations)
  - [Import/Export](#importexport)
  - [Component Data](#component-data)
  - [Node Params](#node-params)
- [Full Examples](#full-examples)
  - [React](#react)
  - [HTML/CSS](#htmlcss)
- [WIP](#wip)

## Overview

This plugin allows you to write and generate code snippets for Figma nodes, which are rendered in the Inspect Panel in [Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode). You can make these code snippets dynamic, by referring to parameters provided by the plugin. Doing this for your component library will bring accurate code snippets to any project that incorporates your design system.

Code snippets are saved in [shared plugin data](https://www.figma.com/plugin-docs/api/properties/nodes-setsharedplugindata/) using the keys `node.getSharedPluginData("codesnippets", "snippets")`. A benefit of shared plugin data is that any plugin can make use of or update these snippets.

You can add code snippets using the Snippet Editor, which is accessible from the settings menu of the plugin in Dev Mode's Inspect Panel:

![Screenshot 2023-12-04 at 10 14 46 PM](https://github.com/figma/code-snippet-editor-plugin/assets/57682038/5883b5bb-f97e-436d-b6ac-d0c4f2d410fd)


Any snippets added to a Component or ComponentSet will also be propagated to any Instances.

Snippets can either be static or utilize the snippet templating language, which is detailed below.

## Templating

Each line of a code snippet is individually evaluated. Lines of a snippet can include dynamic symbols or qualifiers that refer to parameters from the selected node in Figma. Template parameters are all treated like strings. There is no concept of primitives (number, boolean, etc) in this templating language.

### Symbols

Each line can feature one or more symbols, enclosed in curly brackets like `{{something}}`.

```
Hello {{something}}!
```

If `something` was defined as `"world"`, this would render `"Hello world!"`.

For a line to render, the appropriate data must be present. If `something` was not defined at all, the line would not render.

### Qualifiers

Each line can start with a qualifying statement. Qualifiers do not render anything by themselves, they are logical ammendments to the line.

Qualifiers can be either affirmative with a question mark `{{?something=yes}}`, or negative with an exclamation mark `{{!something=yes}}`. For a line to render, these statements must be validated.

You can also detect the presence of a property by omitting the equals sign and value. For example, `{{?something}}` and `{{!something}}` would be the affirmative and negative statement for the presence and absence of `something`.

```
{{?something}}something exists!
{{!something}}something does not exist!
{{?something=yes}}something is "yes"
{{!something=yes}}something is not "yes"
```

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

The values you can refer to in symbols and qualifiers are called "params". These parameters are formatted as `prefix.param`.

> Enable ["Details mode"](#details-mode) to see all the params available for your selection!

> All param values are strings.

### `autolayout`

The detected [`InferredAutoLayout`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/) properties. Currently limited to
[`layoutMode`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#layoutmode), [`layoutWrap`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#layoutwrap), [`paddingLeft`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingleft), [`paddingRight`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingright), [`paddingTop`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingtop), [`paddingBottom`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingbottom), [`itemSpacing`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#itemspacing) and [`counterAxisSpacing`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#counteraxisspacing)

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

### `node`

Contains the name and type for the selected node. If a Component or ComponentSet, `node.key` will also be provided.

```json
{
  "node.name": "icon-heart",
  "node.type": "instance"
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
figma-is-great
FIGMA_IS_GREAT
```

## “Details Mode”

Details mode can be enabled from the plugin settings menu.

In addition to the current snippets, it will display any templates being referenced, as well as JSON view of all the [params](#params) available for the current selection.

Details mode is really useful when you’re building or debuigging your templates!

## Bulk Operations

Running the plugin in design mode will open a window allowing you to perform bulk operations.

### Import/Export

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
  "19ab8ffd23dae11c49cdecb3bd9860dc388df0de": [
    {
      "language": "JAVASCRIPT",
      "code": "<Button\n  {{?property.state = disabled}}disabled\n  variant=\"{{property.variant}}\"\n  {{?property.iconStart.b=true}}iconStart={<{{property.iconStart.i|pascal}} />}\n  {{?property.iconEnd.b=true}}iconEnd={<{{property.iconEnd.i|pascal}} />}\n  onClick={() => {}}\n>\n  {{property.label|raw}}\n</Button>",
      "title": "My Special Template"
    }
  ],
  "6d607532d158046a9a6a3cc6f68a40e9cf59f006": []
}
```

When importing, if the component key is present in the current file, its templates will be overwritten.

Importing an empty array for a component key will remove all snippets for that component.

Components whose keys are not definied in the JSON are not effected by an import, even if they have snippets defined in Figma.

### Component Data

The `"Component data"` action exports all component data for all non-variant components in the file as JSON.

```json
{
  "19ab8ffd23dae11c49cdecb3bd9860dc388df0de": {
    "name": "Button",
    "description": "Common button used for user actions.",
    "lineage": "Button/Button Frame"
  },
  "d4f127de723bbc099be23260a223af942b194606": {
    "name": "Icon Button",
    "description": "Common icon button used for user actions.",
    "lineage": "Icon Button/Icon Button Frame"
  }
}
```

This is useful if you want to start building snippet templates in bulk, but dont know the component keys for your components.

The JSON schema for component data is:

```ts
type FileData = {
  [k: ComponentKey]: {
    name: string;
    description: string;
    lineage: string;
  };
};
```

`name` and `description` are the name and description of the component. The lineage is a `/` separated breadcrumbs of node names to the page. This can be helpful when trying to understand which component you’re looking at.

### Node Params

The `"Node Data"` action returns [params](#params) for all nodes in the current selection.

This output is useful if you want to analyze params for many nodes outside of the plugin interface, especially if youre building your snippet templates externally.

In addition to hyphenated default `params`, it includes the `raw` params as a separate object.

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
