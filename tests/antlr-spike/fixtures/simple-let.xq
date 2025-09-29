xquery version "1.0-ml";

let $nodes := (//*[not(*)])[1 to 3]
return $nodes