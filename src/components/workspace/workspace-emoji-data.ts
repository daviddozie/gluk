export type EmojiCategory = {
  name: string;
  keywords: string;
  emojis: string;
};

/** Common Unicode emoji, grouped for browsing and searchable by expression or topic. */
export const WORKSPACE_EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "Faces",
    keywords: "face faces smile happy joy laugh grin cheerful tears cry sad angry upset worry anxious confused thinking surprised shocked tired sleepy sick dizzy silly tongue wink cool love heart kiss affection",
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 🥹 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 🙂‍↔️ 🙂‍↕️ 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🫡 🤫 🫠 🤥 😶 😶‍🌫️ 😐 😑 😬 🫨 🫥 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 😵‍💫 🫩 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊",
  },
  {
    name: "Hearts & affection",
    keywords: "heart hearts love affection romance friendship like break broken cute",
    emojis: "❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝 💟 ❣️ 💌 💋 💑 👩‍❤️‍👨 👨‍❤️‍👨 👩‍❤️‍👩 🫶",
  },
  {
    name: "Hands & gestures",
    keywords: "hand hands gesture finger wave hello goodbye clap praise thanks pray please agree disagree point fist high five strength rock paper peace",
    emojis: "👋 👋🏻 👋🏼 👋🏽 👋🏾 👋🏿 🤚 🤚🏻 🤚🏼 🤚🏽 🤚🏾 🤚🏿 🖐️ 🖐🏻 🖐🏼 🖐🏽 🖐🏾 🖐🏿 ✋ ✋🏻 ✋🏼 ✋🏽 ✋🏾 ✋🏿 🖖 🖖🏻 🖖🏼 🖖🏽 🖖🏾 🖖🏿 🫱 🫱🏻 🫱🏼 🫱🏽 🫱🏾 🫱🏿 🫲 🫲🏻 🫲🏼 🫲🏽 🫲🏾 🫲🏿 🫳 🫳🏻 🫳🏼 🫳🏽 🫳🏾 🫳🏿 🫴 🫴🏻 🫴🏼 🫴🏽 🫴🏾 🫴🏿 🫷 🫷🏻 🫷🏼 🫷🏽 🫷🏾 🫷🏿 🫸 🫸🏻 🫸🏼 🫸🏽 🫸🏾 🫸🏿 👌 👌🏻 👌🏼 👌🏽 👌🏾 👌🏿 🤌 🤌🏻 🤌🏼 🤌🏽 🤌🏾 🤌🏿 🤏 🤏🏻 🤏🏼 🤏🏽 🤏🏾 🤏🏿 ✌️ ✌🏻 ✌🏼 ✌🏽 ✌🏾 ✌🏿 🤞 🤞🏻 🤞🏼 🤞🏽 🤞🏾 🤞🏿 🫰 🫰🏻 🫰🏼 🫰🏽 🫰🏾 🫰🏿 🤟 🤟🏻 🤟🏼 🤟🏽 🤟🏾 🤟🏿 🤘 🤘🏻 🤘🏼 🤘🏽 🤘🏾 🤘🏿 🤙 🤙🏻 🤙🏼 🤙🏽 🤙🏾 🤙🏿 👈 👈🏻 👈🏼 👈🏽 👈🏾 👈🏿 👉 👉🏻 👉🏼 👉🏽 👉🏾 👉🏿 👆 👆🏻 👆🏼 👆🏽 👆🏾 👆🏿 🖕 🖕🏻 🖕🏼 🖕🏽 🖕🏾 🖕🏿 👇 👇🏻 👇🏼 👇🏽 👇🏾 👇🏿 ☝️ ☝🏻 ☝🏼 ☝🏽 ☝🏾 ☝🏿 🫵 🫵🏻 🫵🏼 🫵🏽 🫵🏾 🫵🏿 👍 👍🏻 👍🏼 👍🏽 👍🏾 👍🏿 👎 👎🏻 👎🏼 👎🏽 👎🏾 👎🏿 ✊ ✊🏻 ✊🏼 ✊🏽 ✊🏾 ✊🏿 👊 👊🏻 👊🏼 👊🏽 👊🏾 👊🏿 🤛 🤛🏻 🤛🏼 🤛🏽 🤛🏾 🤛🏿 🤜 🤜🏻 🤜🏼 🤜🏽 🤜🏾 🤜🏿 👏 👏🏻 👏🏼 👏🏽 👏🏾 👏🏿 🙌 🙌🏻 🙌🏼 🙌🏽 🙌🏾 🙌🏿 👐 👐🏻 👐🏼 👐🏽 👐🏾 👐🏿 🤲 🤲🏻 🤲🏼 🤲🏽 🤲🏾 🤲🏿 🤝 🙏 🙏🏻 🙏🏼 🙏🏽 🙏🏾 🙏🏿 ✍️ ✍🏻 ✍🏼 ✍🏽 ✍🏾 ✍🏿 💅 💅🏻 💅🏼 💅🏽 💅🏾 💅🏿 🤳 🤳🏻 🤳🏼 🤳🏽 🤳🏾 🤳🏿 💪 💪🏻 💪🏼 💪🏽 💪🏾 💪🏿 🦾 🦿 🦵 🦵🏻 🦵🏼 🦵🏽 🦵🏾 🦵🏿 🦶 🦶🏻 🦶🏼 🦶🏽 🦶🏾 🦶🏿 👂 👂🏻 👂🏼 👂🏽 👂🏾 👂🏿 🦻 🦻🏻 🦻🏼 🦻🏽 🦻🏾 🦻🏿 👃 👃🏻 👃🏼 👃🏽 👃🏾 👃🏿 🫀 🫁 🧠 🦷 🦴 👀 👁️ 👅 👄 🫦",
  },
  {
    name: "People",
    keywords: "people person family adult child baby man woman person hair job profession relationship dance walk run swim sit stand accessibility skin tone",
    emojis: "👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🫃 🫄 🤱 👼 🎅 🤶 🧑‍🎄 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🕴️ 👯 🧖 🧗 🤺 🏇 ⛷️ 🏂 🏌️ 🏄 🚣 🏊 ⛹️ 🏋️ 🚴 🚵 🤸 🤼 🤽 🤾 🤹 🧘 🛀 🛌 🧑‍⚕️ 👨‍⚕️ 👩‍⚕️ 🧑‍🎓 👨‍🎓 👩‍🎓 🧑‍🏫 👨‍🏫 👩‍🏫 🧑‍⚖️ 👨‍⚖️ 👩‍⚖️ 🧑‍🌾 👨‍🌾 👩‍🌾 🧑‍🍳 👨‍🍳 👩‍🍳 🧑‍🔧 👨‍🔧 👩‍🔧 🧑‍🏭 👨‍🏭 👩‍🏭 🧑‍💼 👨‍💼 👩‍💼 🧑‍🔬 👨‍🔬 👩‍🔬 🧑‍💻 👨‍💻 👩‍💻 🧑‍🎤 👨‍🎤 👩‍🎤 🧑‍🎨 👨‍🎨 👩‍🎨 🧑‍✈️ 👨‍✈️ 👩‍✈️ 🧑‍🚀 👨‍🚀 👩‍🚀 🧑‍🚒 👨‍🚒 👩‍🚒 👨‍👩‍👦 👨‍👩‍👧 👨‍👩‍👧‍👦 👨‍👨‍👦 👨‍👨‍👧 👨‍👨‍👧‍👦 👩‍👩‍👦 👩‍👩‍👧 👩‍👩‍👧‍👦 👨‍👦 👨‍👧 👩‍👦 👩‍👧 👩‍👧‍👦 🧑‍🤝‍🧑 👭 👫 👬 💏 👩‍❤️‍👨 👨‍❤️‍👨 👩‍❤️‍👩",
  },
  {
    name: "Animals & nature",
    keywords: "animal animals nature pet mammal bird reptile sea ocean bug insect flower plant tree weather sun moon star sky",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🦍 🦧 🐔 🐧 🐦 🐦‍⬛ 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🫎 🫏 🐝 🪱 🐛 🦋 🐌 🪲 🐞 🐜 🪰 🪳 🦟 🦗 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🪼 🪸 🐠 🐟 🐡 🐬 🦈 🦭 🐳 🐋 🐊 🦓 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🦮 🐕‍🦺 🐩 🐈 🐈‍⬛ 🪶 🪽 🐓 🦃 🦤 🦚 🦜 🪽 🦢 🦩 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🐉 🐲 🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🎋 🍃 🍂 🍁 🪺 🪹 🍄 🪾 🌾 💐 🌷 🪷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 ☔ ☂️ 🌊",
  },
  {
    name: "Food & drink",
    keywords: "food drink fruit vegetable meal cooking dessert sweet coffee tea beer wine restaurant hungry",
    emojis: "🍇 🍈 🍉 🍊 🍋 🍋‍🟩 🍌 🍍 🥭 🍎 🍏 🍐 🍑 🍒 🍓 🫐 🥝 🍅 🫒 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🥜 🫘 🌰 🫚 🫛 🍄‍🟫 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🦴 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥛 🍼 ☕ 🫖 🍵 🧃 🥤 🧋 🧉 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧊 🥄 🍴 🍽️ 🥣 🥡 🥢 🧂",
  },
  {
    name: "Travel & places",
    keywords: "travel place transport vehicle car bus train plane boat ship road building home house city map direction",
    emojis: "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦽 🦼 🛴 🚲 🛵 🏍️ 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🛟 ⛽ 🚧 🚦 🚥 🚏 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ♨️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🛖 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏛️ ⛪ 🕌 🛕 🕍 ⛩️ 🕋 ⛪ 🛤️ 🛣️ 🧱 🪨 🪵 🛢️ 🛎️ 🧳 🧭 🎑 🏞️ 🌅 🌄 🌇 🌆 🏙️ 🌃 🌉 🌁 🎇 🎆 🌌 🌠 🗾 🧱",
  },
  {
    name: "Activities & objects",
    keywords: "activity sport game music art celebration party trophy medal hobby work tool science technology phone computer camera book writing mail gift",
    emojis: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🪘 🎷 🎺 🪗 🎸 🪕 🎻 🪈 🎲 ♟️ 🎯 🎳 🎮 🕹️ 🧩 🪅 🪩 🪆 🃏 🀄 🧸 🪄 🎃 🎄 🎆 🎇 🧨 🎈 🎉 🎊 🎋 🎍 🎎 🎏 🎐 🎀 🎁 🎗️ 🏮 🪔 📱 📲 ☎️ 📞 📟 📠 🔋 🪫 🔌 💻 🖥️ 🖨️ ⌨️ 🖱️ 🖲️ 💽 💾 💿 📀 🧮 🎥 🎞️ 📽️ 🎬 📺 📷 📸 📹 📼 🔍 🔎 🕯️ 💡 🔦 🏮 🪔 📔 📕 📖 📗 📘 📙 📚 📓 📒 📃 📜 📄 📰 🗞️ 📑 🔖 🏷️ 💰 🪙 💴 💵 💶 💷 💸 💳 🧾 ✉️ 📧 📨 📩 📤 📥 📦 📫 📪 📬 📭 📮 🗳️ ✏️ ✒️ 🖋️ 🖊️ 🖌️ 🖍️ 📝 💼 📁 📂 🗂️ 📅 📆 🗒️ 🗓️ 📇 📈 📉 📊 📋 📌 📍 📎 🖇️ 📏 📐 ✂️ 🗃️ 🗄️ 🗑️ 🔒 🔓 🔏 🔐 🔑 🗝️ 🔨 🪓 ⛏️ ⚒️ 🛠️ 🗡️ ⚔️ 💣 🪃 🏹 🛡️ 🔧 🪛 🔩 ⚙️ 🗜️ ⚖️ 🦯 🔗 ⛓️ 🪝 🧰 🧲 🪜 ⚗️ 🧪 🧫 🧬 🔬 🔭 📡 💉 🩸 💊 🩹 🩺 🩻 🚪 🛗 🪞 🪟 🛏️ 🛋️ 🪑 🚽 🪠 🚿 🛁 🪤 🪒 🧴 🧷 🧹 🧺 🧻 🪣 🧼 🫧 🪥 🧽 🧯 🛒 🚬 ⚰️ 🪦 ⚱️ 🧿 🪬 🪧 🪪 🩼",
  },
  {
    name: "Symbols & flags",
    keywords: "symbol symbols sign number punctuation check cross warning question exclamation arrow zodiac flag country alphabet",
    emojis: "❤️‍🔥 💯 🔥 ✨ ⭐ 🌟 💫 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ ♾️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ ❓ ❔ ❕ ❗ ‼️ ⁉️ 💬 🗨️ 🗯️ 💭 💤 🕳️ 💢 💥 💦 💨 🕊️ 🛑 🚫 ⛔ 📛 🚷 🚯 🚳 🚱 🔞 📵 🔕 🔇 🔈 🔉 🔊 📢 📣 📴 📳 🆗 🆕 🆙 🆒 🆓 🆖 🆘 🆔 🆚 🈁 🈂️ 🈷️ 🈶 🈯 🉐 🈹 🈚 🈲 🉑 🈸 🈴 🈳 ㊗️ ㊙️ 🈺 🈵 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔘 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ◼️ ◻️ ◾ ◽ ▪️ ▫️ 🔈 🔔 🔕 🎵 🎶 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ 🔃 🔄 🔙 🔚 🔛 🔜 🔝 🛐 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 🪯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎ 🆎 🔠 🔡 🔢 🔣 🔤 🔣 🅰️ 🅱️ 🆑 🅾️ 🆘 🆙 🆚 🈂️ 🈯 🈹 🈚 🈲 🈳 🈴 🈵 🈶 🈷️ 🈸 🈺 🉐 🉑 🈁 🏳️ 🏴 🏁 🚩 🏳️‍🌈 🏳️‍⚧️ 🇺🇸 🇬🇧 🇨🇦 🇦🇺 🇳🇿 🇮🇪 🇳🇬 🇬🇭 🇰🇪 🇿🇦 🇪🇬 🇲🇦 🇫🇷 🇩🇪 🇮🇹 🇪🇸 🇵🇹 🇳🇱 🇧🇪 🇨🇭 🇸🇪 🇳🇴 🇩🇰 🇫🇮 🇮🇸 🇵🇱 🇺🇦 🇷🇺 🇹🇷 🇸🇦 🇦🇪 🇮🇱 🇮🇳 🇵🇰 🇧🇩 🇯🇵 🇨🇳 🇰🇷 🇹🇭 🇻🇳 🇵🇭 🇮🇩 🇲🇾 🇸🇬 🇧🇷 🇲🇽 🇦🇷 🇨🇱 🇨🇴 🇯🇲 🇺🇳 🏴‍☠️",
  },
];

export const QUICK_WORKSPACE_REACTIONS = ["👍", "❤️", "😂", "🎉"];

const SKIN_TONE_EMOJI_BASES = "👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 🦸 🦹 🧙 🧚 🧛 🧜 🧝 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🕴️ 🧖 🧗 ⛷️ 🏂 🏌️ 🏄 🚣 🏊 ⛹️ 🏋️ 🚴 🚵 🤸 🤼 🤽 🤾 🤹 🧘 🫃 🫄".split(/\s+/);
const SKIN_TONES = ["🏻", "🏼", "🏽", "🏾", "🏿"];

export function emojisInCategory(category: EmojiCategory) {
  const emojis = category.emojis.split(/\s+/).filter(Boolean);
  if (category.name !== "People") return emojis;
  const skinToneVariants = SKIN_TONE_EMOJI_BASES.flatMap((base) => {
    const [first, ...rest] = Array.from(base);
    const suffix = rest.filter((character) => character !== "\uFE0F").join("");
    return SKIN_TONES.map((tone) => `${first}${tone}${suffix}`);
  });
  return [...new Set([...emojis, ...skinToneVariants])];
}
