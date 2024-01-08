# Examples

## Material 3 Design

[Jetpack Compose](https://developer.android.com/jetpack/compose/components/button)

```
{{property.style|pascal}}Button(onClick = { /* something */ }) {
  Icon(Icons.Filled.{{property.icon}})
  Text("{{property.labelText|raw}}")
}
```

[MDC - Android](https://github.com/material-components/material-components-android/blob/master/docs/components/Button.md)

```
<Button
  {{?property.showIcon=true}}style="@style/Widget.Material3.Button.{{property.style|pascal}}Button.Icon"
  {{?property.showIcon=false}}style="@style/Widget.Material3.Button.{{property.style|pascal}}Button"
  android:id="@+id/{{property.style|pascal}}Button"
  android:layout_width="wrap_content"
  android:layout_height="wrap_content"
  android:text="{{property.labelText|raw}}"
  app:icon="@drawable/{{property.icon|raw}}"
/>
```

[Web - MWC](https://github.com/material-components/material-web/blob/main/docs/components/button.md)

```
{{?property.style=tonal}}<md-filled-tonal-button\
{{!property.style=tonal}}<md-{{property.style}}-button\
{{?property.state=disabled}}disabled\
\>
  {{property.labelText|raw}}
{{?property.showIcon=true}}  <svg slot="icon" viewBox="0 0 48 48"><path d="path for {{property.icon}}" /></svg>
{{!property.style=tonal}}</md-{{property.style}}-button>
{{?property.style=tonal}}</md-filled-tonal-button>
```

## Carbon

[React](https://react.carbondesignsystem.com/?path=/story/components-button--default&globals=theme:white)

```
<Button
  {{?property.style=secondary}}kind="secondary"
  {{?property.style=tertiary}}kind="tertiary"
  {{?property.style=danger-primary}}kind="danger"
  {{?property.style=danger-tertiary}}kind="danger--tertiary"
  {{?property.style=danger-ghost}}kind="danger--ghost"
  {{?property.style=ghost}}kind="ghost"
  {{?property.size=small}}size="sm"
  {{?property.size=medium}}size="md"
  {{?property.size=extraLarge}}size="xl"
  {{?property.size=expressive}}size="2xl"
  {{?property.type=icon-only}}hasIconOnly
  {{!property.type=text-only}}renderIcon={Add}
  {{?property.state=disabled}}disabled
>
  Button Text
</Button>
```

## Bootstrap

[HTML](https://getbootstrap.com/docs/5.0/components/buttons/)

```
<button
  type="button"
  {{?property.state=disabled}}disabled
  class="\\
btn\
{{?property.variant=fill}}btn-{{property.color}}\
{{?property.variant=outline}}btn-outline-{{property.color}}\
{{?property.variant=soft}}btn-soft-{{property.color}}\
{{?property.size=l}}btn-size-lg\
{{?property.size=s}}btn-size-sm\
\"
>
  {{property.text|raw}}
</button>
```

## MUI

[React](https://mui.com/material-ui/react-button/)

```
<Button
  {{!property.size=primary}}color="{{property.color}}"
  {{!property.size=medium}}size="{{property.size}}"
  variant="{{property.variant}}"
  {{?property.state=disabled}}disabled
  {{?property.startIcon.b=true}}startIcon={<{{property.startIcon.i}} />}
  {{?property.endIcon.b=true}}endIcon={<{{property.endIcon.i}} />}
  onClick={() => {}}
>
  {{property.label|raw}}
</Button>
```

## iOS/iPadOS

[Swift](https://developer.apple.com/documentation/SwiftUI/Button)

```
Button("{{property.label|raw}}",\
{{!property.labelType=text}}systemImage: "play",\
action: actionName)
    {{?property.labelType=symbol}}.labelStyle(.iconOnly)
```

## AWS Amplify

[React](https://ui.docs.amplify.aws/react/components/button)

```
<Button
  {{?property.variation=primary}}variation="primary"
  {{?property.variation=link}}variation="link"
  {{?property.variation=warning}}colorTheme="error"
  {{?property.variation=destructive}}variation="primary"
  {{?property.variation=destructive}}colorTheme="error"
  {{?property.isDisabled=true}}isDisabled={true}
  {{!property.size=default}}size="{{property.size}}"
  loadingText="Loading..."
  onClick={() => {}}
>
  {{property.label|raw}}
</Button>
```

## Fluent 2 Web

[React](https://fluent2.microsoft.design/components/web/react/button/usage) &bull; [Storybook](https://react.fluentui.dev/?path=/docs/components-button-button--default)

```
<Button
{{?property.state=disabled}}disabled
{{!property.style=secondaryDefault}}appearance="{{property.style}}"
{{!property.size=medium}}size="{{property.size}}"
{{!property.layout=textOnly&property.size=large}}icon={<{{property.regularIconSM|pascal}} />}
{{!property.layout=textOnly}}{{?property.size=large}}icon={<{{property.regularIconLarge|pascal}} />}
{{?property.layout=iconBefore}}iconPosition="before"
{{?property.layout=iconOnly}}/>
{{!property.layout=iconOnly}}>
{{!property.layout=iconOnly}} {{property.text|raw}}
{{!property.layout=iconOnly}}</Button>
```
