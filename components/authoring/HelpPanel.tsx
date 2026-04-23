import { NODE_TYPE_HELP } from "@/lib/help/node-type-help";

type Props = {
  nodeType: string;
};

export function HelpPanel({ nodeType }: Props) {
  const help = NODE_TYPE_HELP[nodeType];

  if (!help) {
    return (
      <div className="ng-help-empty">
        <p>No help available for this node type.</p>
      </div>
    );
  }

  return (
    <div className="ng-help-body">
      <div className="ng-help-section">
        <p className="ng-help-section-title">What the player experiences</p>
        <p className="ng-help-summary">{help.summary}</p>
      </div>

      <div className="ng-help-section">
        <p className="ng-help-section-title">Key fields</p>
        <div className="ng-help-fields">
          {help.fields.map((field) => (
            <div key={field.name} className="ng-help-field">
              <span className="ng-help-field-name">{field.name}</span>
              <p className="ng-help-field-desc">{field.description}</p>
              {field.example && (
                <div className="ng-help-example">{field.example}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="ng-help-section">
        <p className="ng-help-section-title">Tips</p>
        <ul className="ng-help-tips">
          {help.tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
