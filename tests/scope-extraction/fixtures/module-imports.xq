xquery version "1.0-ml";

import module namespace cru="https://pubs.cas.org/modules/lib/common-reference-utils" at "/lib/common-reference-utils.xqy";

declare function local:process-reference($ref as element(reference)) as object-node() {
  let $rd := $ref/related-document
  let $source := cru:create-document-source(fn:root($ref)/*, $rd, "journal")
  return object-node {
    "uri": fn:string($rd),
    "title": fn:string($ref/title),
    "source": $source
  }
};

let $test-ref := <reference>
  <title>Test Article</title>
  <related-document can="123">doc-uri</related-document>
</reference>
return local:process-reference($test-ref)