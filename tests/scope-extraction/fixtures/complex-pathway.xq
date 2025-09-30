xquery version "1.0-ml";

import module namespace cru="https://pubs.cas.org/modules/lib/common-reference-utils" at "/lib/common-reference-utils.xqy";

declare function local:best-step-name($step-doc as element(pathway-step)) as xs:string? {
  let $preferred :=
    ($step-doc/pathway-step-identifier[context = "cas-preferred-name"]/id,
     $step-doc/pathway-step-identifier[context = "scientific name"]/id,
     $step-doc/pathway-step-identifier[context = "original-name"]/id,
     $step-doc/pathway-step-identifier/original-name)[1]
  return fn:string($preferred)
};

declare function local:molecule-identifiers($parent-node as element()?) as array-node() {
  array-node {
    for $identifier-node in $parent-node/molecule-identifier
    return object-node {
      "type": fn:string($identifier-node/context),
      "id": fn:string($identifier-node/id)
    }
  }
};

declare function local:base-molecule-json($base-molecule-node as element(base-molecule)) as object-node() {
  object-node {
    "moleculeOriginalName": fn:string($base-molecule-node/molecule-original-name),
    "moleculeCategory": fn:string($base-molecule-node/molecule-category),
    "moleculeType": fn:string($base-molecule-node/molecule-type)
  }
};

let $pathway-uri := "pathway/36f2c169-a2b9-35cd-813b-848d3f68b36b"
let $pathway-doc := fn:doc($pathway-uri)/pathway

return
  object-node {
    "pathwayUri": $pathway-uri,
    "pathwayName": fn:string((
      $pathway-doc/pathway-identifier[context = "cas-preferred-name"]/id,
      $pathway-doc/pathway-name
    )[1]),
    "steps": array-node {
      for $pathway-step-ref in ($pathway-doc/pathway-step)[1 to 5]
      let $rank := xs:decimal($pathway-step-ref/rank)
      let $step-uri := $pathway-step-ref/pathway-step-uri/fn:string()
      let $step-doc := fn:doc($step-uri)/pathway-step
      order by $rank ascending, fn:string($step-uri) ascending
      return
        object-node {
          "stepUri": $step-uri,
          "rank": number-node { $rank },
          "name": local:best-step-name($step-doc)
        }
    }
  }