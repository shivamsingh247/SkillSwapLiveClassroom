import'@livekit/protocol';/** A Fixed TokenSource is a token source that takes no parameters and returns a completely
 * independently derived value on each fetch() call.
 *
 * The most common downstream implementer is {@link TokenSourceLiteral}.
 */
class TokenSourceFixed {}
/** A Configurable TokenSource is a token source that takes a
 * {@link TokenSourceFetchOptions} object as input and returns a deterministic
 * {@link TokenSourceResponseObject} output based on the options specified.
 *
 * For example, if options.participantName is set, it should be expected that
 * all tokens that are generated will have participant name field set to the
 * provided value.
 *
 * A few common downstream implementers are {@link TokenSourceEndpoint}
 * and {@link TokenSourceCustom}.
 */
class TokenSourceConfigurable {}export{TokenSourceConfigurable,TokenSourceFixed};//# sourceMappingURL=types.mjs.map
