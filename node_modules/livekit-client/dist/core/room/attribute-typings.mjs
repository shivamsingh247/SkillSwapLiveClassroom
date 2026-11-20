// This file was generated from JSON Schema using quicktype, do not modify it directly.
// The code generation lives at https://github.com/livekit/attribute-definitions
//
// To parse this data:
//
//   import { Convert, AgentAttributes, TranscriptionAttributes } from "./file";
//
//   const agentAttributes = Convert.toAgentAttributes(json);
//   const transcriptionAttributes = Convert.toTranscriptionAttributes(json);
// Converts JSON strings to/from your types
class Convert {
  static toAgentAttributes(json) {
    return JSON.parse(json);
  }
  static agentAttributesToJson(value) {
    return JSON.stringify(value);
  }
  static toTranscriptionAttributes(json) {
    return JSON.parse(json);
  }
  static transcriptionAttributesToJson(value) {
    return JSON.stringify(value);
  }
}export{Convert};//# sourceMappingURL=attribute-typings.mjs.map
