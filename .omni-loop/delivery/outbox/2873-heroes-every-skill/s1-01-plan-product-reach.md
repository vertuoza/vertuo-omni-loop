---
id: s1-01-plan-product-reach
prd: 2873
slice: s1
rank: high
bears-on: BR-PRODUCT-63
raised: 2026-11-14
wave: 1
---

## The question, in plain words

Should a build sent from a product's plan repository reach that product's repositories even when the product does not list the plan repository among its own?

## The decision, in plain words

Yes: the build reaches the repositories of every product that names it as its plan repository, as well as those of the products that list it. It still reaches only repositories of the same workspace, that the key allows and that the Omni App is installed on.

## The intro, for fun

A plan repository can lead a product without being one of its listed repositories.

## The punchline, for fun

The captain gets the keys to the ship, even if not on the crew list.

## The options, in plain words

A. A. Reach the products that list the repository and those whose plan repository it is (built).
B. B. Reach only the products that list the repository, as a mega bug fix did: an owner must list the plan repository in its product.
C. C. Like A, but for the ultra skills only, leaving the mega bug fix as it was.

## What I had to decide

The spec says an ultra job's token covers the product's repositories, the way a mega bug fix's does. A mega bug fix finds its product by the product's list of repositories only. A product names its plan repository in a field of its own, and nothing makes it list that repository too, so an ultra job from such a plan repository would get a token for itself alone and stop at its first clone. I added the products whose plan repository is the job's repository to what the token reaches, for every skill that spans the product, the mega bug fix included.

## What I did meanwhile

Built it: the token covers the repositories of the products that list the job's repository and of those whose plan repository it is, once each, within the key's allow-list, and only those the App's installation holds. A test covers a plan repository its product does not list, an archived product and a product whose plan repository is another.

## What it costs to change later

A constant: dropping the second source is one line in the service and its tests. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether every plan repository in use today is also listed in its product (author): I could not read the production database from here.
