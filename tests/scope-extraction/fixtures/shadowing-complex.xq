xquery version "1.0-ml";

let $outer := "outer"
for $item in 1 to 3
let $outer := "middle"
return
  for $nested in 1 to 2
  let $outer := "inner"
  let $item := $item * 10
  return object-node {
    "outer": $outer,
    "item": $item,
    "nested": $nested
  }