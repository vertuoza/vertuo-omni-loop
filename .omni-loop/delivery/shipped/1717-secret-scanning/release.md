---
prd: 1717
title: Secret scanning and push protection, switched on and kept on
---
This public repository now refuses any push holding a real credential: secret scanning and push protection are on. Test fakes are built at runtime and a guard refuses literal ones. A daily workflow opens an issue if either setting goes off.
