# Code Snippets: Plugin Documentation

## Plugin Description

This plugin primarily stores and retrieves code snippets on nodes during the code generation process in Dev Mode. The snippets are saved in [shared plugin data](https://www.figma.com/plugin-docs/api/properties/nodes-setsharedplugindata/) using the keys `node.getSharedPluginData("codesnippets", "snippets")`.

You can append snippets to nodes using the Snippet Editor, which is accessible in the settings menu of the codegen plugin.

Any snippets tied to a Component or ComponentSet will also be available to their Instances.

Snippets can either be static or utilize the snippet templating language, which is detailed below.

## Snippet Templating

### Templating Syntax

Each line of a code snippet is individually evaluated. Each line can feature one or more symbols, enclosed in curly brackets like `{{something}}`. For a line to render, the appropriate data must be present. Each line can start with a qualifying statement, either affirmative `{{?something=true}}` or negative `{{!something=true}}`. For a line to render, these statements must be validated.

```
something={{property}} renders if property exists
{{?property=value}} renders if property is "value"
{{?property1=value}} {{property2}} renders if property1 is "value" and property2 exists
{{!property1=value}} {{property1}} renders if property1 exists and is not "value"
{{!property1=value}} {{property1}} {{property2}} renders if property1 exists and is not "value" and property2 exists
```

Multiple lines in a snippet template can be rendered as a single line (e.g., a list of CSS class names). The following would render `hello world`.

```
hello\
world
```

To remove a leading or trailing space, you can prefix or suffix an extra `\`.

```
"\
hello\
world\
"
```

becomes `" hello world "` with an extra space at the beginning and end, whereas...

```
"\\
hello\
world\
\"
```

...would yield `"hello world"` due to the extra trailing slash on line one and leading slash on line four.

### Filters

All strings can be filtered into different cases. Default filter is lowercased hyphenation.

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

...yields

```
figma-is-great
Figma is great!
FigmaIsGreat
figmaIsGreat
figma-is-great
FIGMA_IS_GREAT
```

### Mapping Figma Data to Template Parameters API

Upon selecting a node, the Code Snippets plugin will make Figma data available to populate your templates as "params". All param values are strings.

These parameters are formatted as `prefix.param`. The prefixes include: `node`, `component`, `css`, and `property`. To preview the params for the current node, you can enable "Details mode" in the codegen plugin settings.

For instance, a simple icon component instance with no component properties would look like this:

```json
{
  "node.name": "icon-heart-solid",
  "node.type": "instance",
  "component.key": "8bf1e25fb834ff1ab666c69a08da1cd555746731",
  "component.type": "component",
  "component.name": "icon-heart-solid",
  "css.width": "24px",
  "css.height": "24px"
}
```

The prefixes are:

- **node**: Contains the name and type for the selected node. If a Component or ComponentSet, `node.key` will also be provided.
- **component**: Contains data for the primary Component / ComponentSet. This is the "topmost" component node (which would have the component property definitions on it). For ComponentSets, variant Components, or their Instances, this will be the ComponentSet's key, type, and name. Any other Component and Instance will be the main Component.
- **css**: Contains output from [`node.getCSSAsync()`](https://www.figma.com/plugin-docs/api/ComponentNode/#getcssasync). Any CSS returned by the Figma API will be here with the `css.*` prefix.
- **property** If the current node is a Component/Instance containing component properties, these will be under the `property.*` params namespace. For instance, a basic button component might look like this:
- **autolayout** The detected [`InferredAutoLayout`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/) properties. Currently limited to
  [`layoutMode`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#layoutmode), [`layoutWrap`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#layoutwrap), [`paddingLeft`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingleft), [`paddingRight`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingright), [`paddingTop`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingtop), [`paddingBottom`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#paddingbottom), [`itemSpacing`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#itemspacing) and [`counterAxisSpacing`](https://www.figma.com/plugin-docs/api/InferredAutoLayoutResult/#counteraxisspacing)
- **variables** The [`boundVariables`](https://www.figma.com/plugin-docs/api/FrameNode/#boundvariables) on the current node.

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

If variables have a [codeSyntax](https://www.figma.com/plugin-docs/api/CodeSyntaxPlatform/), they are represented in addition to the raw name as the first initial of the syntax platform (`WEB`, `ANDROID`, and `iOS` are represented as `variables.*.w`, `variables.*.a`, and `variables.*.i`). For example, a node with a `itemSpacing` bound to a variable named `spacing/spacing-sm` which has a `WEB` codeSyntax set to `--spacing-sm` would have the following "raw" values:

```json
{
  "variables.itemSpacing": "spacing/spacing-sm",
  "variables.itemSpacing.w": "--spacing-sm"
}
```

> Note: If more than one property of the same type share a normalized name, only one value will be available.

### Template Examples

#### switch/case

```
{{?property=a}}line 1
{{?property=b}}line 2
{{?property=c}}line 3
```

#### if/else value match

```
{{?property=a}}line 1
{{!property=a}}line 2
```

#### if/else exists

```
{{?property}}line 1
{{!property}}line 2
```

#### Round Trip: React

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

#### Round Trip: CSS Class

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

## WIP

- For the non-component node types, you want to have a default template to render rather than storing a templates on individual nodes.Still trying to think of the best place to store/access those templates. Saving on page node might work for some, but a global solution might be better.
- Add an action that opens up documentation of the language in an iframe!
