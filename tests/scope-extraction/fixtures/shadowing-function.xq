xquery version "1.0-ml";

declare function local:process($value as xs:decimal) as xs:decimal {
  let $value := $value * 2
  return $value
};

let $value := 10
return local:process($value)