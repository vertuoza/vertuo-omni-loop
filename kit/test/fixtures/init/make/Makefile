VERSION := 1

.PHONY: test preflight

test:
	vendor/bin/phpunit

preflight: test
	vendor/bin/phpstan
