## BL-APPROVALS-1
An approval covers exactly the files the approver read. Any later change to one of them voids the
approval, and the build waits for a new one.
Why: An approver who signs one text and gets another stops trusting every approval.
Also: gate
