xquery version "1.0-ml";

declare function local:process-item($item as element(), $multiplier as xs:decimal) as xs:decimal {
  let $base-value := xs:decimal($item/value)
  let $result := $base-value * $multiplier
  return $result
};

declare function local:format-result($value as xs:decimal, $label as xs:string) as object-node() {
  object-node {
    "label": $label,
    "value": $value
  }
};

let $test-item := <item><value>42</value></item>
let $multiplier := 2.5
let $calculated := local:process-item($test-item, $multiplier)
return local:format-result($calculated, "Test Result")