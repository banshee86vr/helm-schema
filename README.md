# @bertelli.luca/helm-schema ![npm (scoped)](https://img.shields.io/npm/v/%40bertelli.luca/helm-schema)

[JSON Schema](https://json-schema.org) generator for your [HELM charts](https://helm.sh).

Project forked from: https://github.com/SocialGouv/helm-schema
Demo : https://socialgouv.github.io/helm-schema

## Usage

Example `values.yaml`, following [JSDoc standards](https://devhints.io/jsdoc)

```yaml
# @param {object} smtp Your SMTP setup
smtp:
  # @param {string} host SMTP hostname
  host:
  # @param {number} [port] SMTP port
  port: 587

# @param {enum{IfNotPresent,Always,Never}} pullPolicy Specifies whether a container image should be created
pullPolicy: IfNotPresent
# @param {pattern{^(.*)\?$}} name Application name validated by a pattern
name: IfNotPresent
# @param {integer{min=0,max=5}} replicaCount Number of possible replica with a fixed range
replicaCount: 3
# @param {string{minLength=10,maxLength=15}} username Username with limited length range
username: banshee86vr

# Setup your securityContext to reduce security risks, see https://kubernetes.io/docs/tasks/configure-pod-container/security-context/
# @param {https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master/v1.24.0/_definitions.json#/definitions/io.k8s.api.core.v1.PodSecurityContext} [securityContext]
securityContext:
```

To generate a JSON schema from your `values.yaml` :

```sh
npx @bertelli.luca/helm-schema -f values.yaml
```

Or via TS :

```js
import { toJsonSchema } from "@bertelli.luca/helm-schema";

import yaml from "./values.yaml";

const schema = toJsonSchema(yaml);
```

You get such JSON schema in result :

```json
{
  "type": "object",
  "$schema": "http://json-schema.org/draft-07/schema",
  "required": [
    "smtp",
    "pullPolicy",
    "name",
    "replicaCount",
    "username"
  ],
  "properties": {
    "smtp": {
      "type": "object",
      "title": "Your SMTP setup",
      "required": [
        "host"
      ],
      "properties": {
        "host": {
          "type": [
            "string"
          ],
          "title": "SMTP hostname"
        },
        "port": {
          "type": [
            "number"
          ],
          "title": "SMTP port",
          "default": "587"
        }
      }
    },
    "pullPolicy": {
      "type": [
        "string",
        "boolean",
        "number",
        "object",
        "array"
      ],
      "enum": [
        "IfNotPresent",
        "Always",
        "Never"
      ],
      "title": "Specifies whether a container image should be created",
      "default": "IfNotPresent"
    },
    "name": {
      "type": "string",
      "pattern": "^(.*)\\?$",
      "title": "Application name validated by a pattern",
      "default": "IfNotPresent"
    },
    "replicaCount": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5,
      "title": "Number of possible replica with a fixed range",
      "default": "3"
    },
    "username": {
      "type": "string",
      "minLength": 10,
      "maxLength": 15,
      "title": "Username with limited length range",
      "default": "banshee86vr"
    }
  }
}
```

This schema can then be used with your favorite editor for HELM values validation.

⚠️ Be sure to add an `$id` to the schema if its meant to be referenced from other schemas

## Dev

update snapshots : `yarn snapshots`
