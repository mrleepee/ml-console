xquery version "1.0-ml";

for $doc in fn:collection()
let $id := $doc/@id
where fn:exists($id)
order by $id ascending
return
  for $item in $doc/items/item
  let $name := $item/name/text()
  let $value := $item/value/text()
  return object-node {
    "id": $id,
    "name": $name,
    "value": $value
  }