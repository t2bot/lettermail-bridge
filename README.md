# Bridge is under development

**This project is under development. The documentation may be lying to you while the thing is built.**

Proceed with caution.

# lettermail-bridge

![Matrix](https://img.shields.io/matrix/lettermail-bridge:matrix.org?style=flat-square)

Proof of concept bridge between [Matrix](https://matrix.org) and the postal network.

The bridge uses [Earth Class Mail](https://www.earthclassmail.com/) to receive mail and 
[Lob](https://www.lob.com/) to send mail. These providers were chosen for their API capabilities,
though can be quite pricey in combination. There are several email-based postal providers which
could be used, however that would make this bridge an email bridge instead of a postal bridge.

For more information about the bridge's purpose or information on how to try it out please visit
https://t2bot.io/lettermail

## Running your own

If for some reason you'd like to run your own bridge, here's what you need to know. Note that the
bridge isn't currently capable of being a personal mailbox for an individual and is instead aimed
towards hosted integration providers like t2bot.io.

Aside from the additional accounts, you will need a homeserver like [Synapse](https://github.com/matrix-org/synapse)
which supports application services, and a place to host the bridge (preferably Docker-capable).

1. Create a [Lob](https://www.lob.com/) account. This is the easiest step.
    * After signing up, add a payment method to start using the Live Environment.
2. Create an [Earth Class Mail](https://www.earthclassmail.com/) account. Part of the signup process
   includes getting a notarized USPS Form 1583 to allow Earth Class Mail to process received mail. 
   * The notarization process requires your identity to be verified, and you will be offered an ability
     to notarize the form with a lawyer via video chat.
   * You are not required to be a resident of the United States to create an account, however identity
     verification may be more difficult depending on your resident country. For example, the options
     for documents to use as verification as a Canadian are more limited than those residing in the
     United States.
   * Depending on usage, the smallest personal plan will be fine. The bridge can use an inbox of choice,
     but will default to the first available inbox.
   * **Tip**: You can add aliases to the default recipient in your account settings to avoid having to
     give out your real name when publishing the address.
3. Register the appservice with your homeserver. For Synapse, this will be creatinga YAML file with the
   following contents and recording the path in your `homeserver.yaml`:
   ```yaml
    id: lettermail # Can be any helpful identifier
    hs_token: GENERATE_ME # Both of these should be unique secret tokens
    as_token: GENERATE_ME
    namespaces:
    users:
    - exclusive: true
    regex: '@postal_.*:example.org'  # Replace "example.org" with your homeserver's domain
    aliases: []
    rooms: []
    url: http://localhost:9999  # Point this at wherever the bridge will be running
    sender_localpart: postmaster
    rate_limited: false  # Not important, but can be helpful
   ```
   * Restart your server if required (Synapse requires this).
4. Create a directory for the bridge's Docker container to mount to. For example, `/etc/matrix-lettermail-bridge`
5. In that directory, create a `config` folder and copy https://github.com/t2bot/lettermail-bridge/blob/main/config/default.yaml
   to it as `production.yaml`
   * Edit the configuration accordingly.
6. Run the bridge with something like `docker run --rm -d -v /etc/matrix-lettermail-bridge:/data -p 9999:9999 t2bot/lettermail-bridge:latest`

## Development

Developing on this bridge can be difficult. You'll essentially need the same environment as running your own bridge,
though you are not required to set up your Lob account fully. You will still need a paid Earth Class Mail account.

Depending on what you're looking to test, you'll also need to send some letters to your Earth Class Mail mailbox
to ensure the bridge is operating okay on a local setup. Note that depending on location and mail delivery delays
it could be several weeks before you can begin testing.

Lob's test environment allows you to see the letters it is sending without having to actually send them and wait for
delivery. This is highly recommended.

After installing the dependencies with `yarn install` you can run the bridge with `yarn start:bot`

## Templates

The default templates are all targeted towards t2bot.io as it's (currently) the only expected deployment. The templates
path can be overridden in the config - point it at a directory with all your custom templates. Be sure to copy/paste
any unchanged templates as the bridge will not fall back to defaults when a custom path is given.

The t2bot.io templates can be seen in the `tmpl` directory of this repository.

