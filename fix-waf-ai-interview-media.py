import boto3

REGION = "ap-south-1"
NAME = "career-ai-prod-waf"
WEB_ACL_ID = "fb0af609-68a1-44ca-a8df-130f1eae9bc4"

client = boto3.client("wafv2", region_name=REGION)
current = client.get_web_acl(Name=NAME, Scope="REGIONAL", Id=WEB_ACL_ID)
acl = current["WebACL"]

rules = acl.get("Rules", [])
# Do not add the emergency rule twice.
if any(r.get("Name") == "AllowAIInterviewMediaUpload" for r in rules):
    print("AllowAIInterviewMediaUpload already exists. No change made.")
    raise SystemExit(0)

# Preserve the existing rule order by shifting priorities by one.
for rule in rules:
    rule["Priority"] = int(rule["Priority"]) + 1

allow_rule = {
    "Name": "AllowAIInterviewMediaUpload",
    "Priority": 0,
    "Statement": {
        "ByteMatchStatement": {
            "SearchString": b"/api/v1/ai-interview/media",
            "FieldToMatch": {"UriPath": {}},
            "TextTransformations": [{"Priority": 0, "Type": "NONE"}],
            "PositionalConstraint": "EXACTLY",
        }
    },
    "Action": {"Allow": {}},
    "VisibilityConfig": {
        "SampledRequestsEnabled": True,
        "CloudWatchMetricsEnabled": True,
        "MetricName": "AllowAIInterviewMediaUpload",
    },
}
rules.insert(0, allow_rule)

kwargs = {
    "Name": NAME,
    "Scope": "REGIONAL",
    "Id": WEB_ACL_ID,
    "DefaultAction": acl["DefaultAction"],
    "Rules": rules,
    "VisibilityConfig": acl["VisibilityConfig"],
    "LockToken": current["LockToken"],
}
for optional in ("Description", "CaptchaConfig", "ChallengeConfig", "TokenDomains", "AssociationConfig", "CustomResponseBodies"):
    if optional in acl and acl[optional] is not None and (optional != "Description" or str(acl[optional]).strip()):
        kwargs[optional] = acl[optional]

result = client.update_web_acl(**kwargs)
print("WAF updated successfully.")
print("New allow rule: /api/v1/ai-interview/media")
print(result["NextLockToken"])
