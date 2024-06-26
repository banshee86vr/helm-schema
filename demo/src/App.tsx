import { useState } from "react";
import { GithubForkBanner } from "react-github-fork-banner";
import CodeEditor from "@uiw/react-textarea-code-editor";

import "./App.css";

import { toJsonSchema } from "@bertelli.luca/helm-schema";

const yaml = `
# @param {object} smtp Your SMTP setup
smtp:
  # @param {string} host SMTP hostname
  host:
  # @param {number} [port] SMTP hostname
  port: 587

# Setup your securityContext to reduce security risks, see https://kubernetes.io/docs/tasks/configure-pod-container/security-context/
# @param {https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master/v1.24.0/_definitions.json#/definitions/io.k8s.api.core.v1.PodSecurityContext} [securityContext]
securityContext:

# @params {string[]} command List of parameters for the default entrypoint
command: []

# @param {enum{IfNotPresent,Always,Never}} pullPolicy Specifies whether a container image should be created
pullPolicy: IfNotPresent

# @param {pattern{^.*$}} name Application name validated by a pattern
name: JSONSchemaGenerator

# @param {integer{min=0,max=5}} replicaCount Number of possible replica with a fixed range
replicaCount: 3

# @param {string{minLength=10,maxLength=15}} username Username with limited length range
username: banshee86vr
`.trim();

function App() {
  const [schema, setSchema] = useState(
    JSON.stringify(toJsonSchema(yaml), null, 2)
  );

  const onYamlChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const content = e.target.value;
    setSchema(JSON.stringify(toJsonSchema(content), null, 2));
  };
  return (
    <>
      <GithubForkBanner customHref="https://github.com/banshee86vr/helm-schema"></GithubForkBanner>
      <h1>helm-schema demo</h1>
      <p>
        Annotate your HELM values.yaml files with{" "}
        <a
          href="https://devhints.io/jsdoc"
          target="_blank"
          rel="noopener noreferrer"
        >
          JSDoc comments
        </a>{" "}
        and extract a values.schema.json -{" "}
        <a
          href="https://github.com/banshee86vr/helm-schema"
          target="_blank"
          rel="noopener noreferrer"
        >
          cf Documentation.
        </a>
      </p>
      <div style={{ display: "flex", width: "100%" }}>
        <div
          style={{
            flex: "1 0 auto",
            textAlign: "left",
            width: "50%",
            margin: 5,
          }}
        >
          <div style={{ textAlign: "center" }}>values.yaml</div>
          <CodeEditor
            data-color-mode="light"
            language="yaml"
            value={yaml}
            onChange={onYamlChange}
            style={{ height: 800 }}
          />
        </div>
        <div
          style={{
            flex: "1 0 auto",
            textAlign: "left",
            width: "50%",
            margin: 5,
          }}
        >
          <div style={{ textAlign: "center" }}>values.schema.json</div>
          <CodeEditor
            data-color-mode="light"
            language="json"
            value={schema}
            style={{ height: 800 }}
          />
        </div>
      </div>
    </>
  );
}

export default App;
