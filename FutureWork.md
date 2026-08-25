# TODOs

Make the UI more personal:

- Add photo from the shop
- Make UI less ChatGPT like
- Fix Themeing, separate css files
- Join more types

Extend e2e coverage - look at branch codex/playwright-tests

## Change Request

I dont have time to properly implement the change request, but I will document my suggestions here.
Adding the estimated price should be straight forward. I have stored the price in the backend and can therefore amend it to the order options endpoint that gives me the different service types. I would have to remove some tests that checks if this cost info is not leaked. backend/src/routes/customer.test.ts (line 221). I can then display that info and the sum.

I must also add a new field to the order: Final price that shows what will acutally be paid.
The admin should set the number when they edit the order. To do that there are some questions related to the discount that needs to be answered from the customer.

1. Should the admin calculate the discount themself and add the "final price" or
2. Should the final price be calculated after the admin adds the cost of the order and then set the final price?
3. Should the admin always confirm the final price? or can it just use the suggested one?
4. I added the service type "Other", if the customer wants to keep this, should we force the admin to change this, regarding of the decision on question #3.

Regarding the decisions, the solution can be quite similar. The admin will be shown the Estimated cost, the Discount value and the final price (this depends on the direction).
The selected number should also be added to the final price that the customer sees on the order lookup. It should replace the estimated price. (So either show Estimated Price: 123 NOK, or Final Price: 200 NOK)
