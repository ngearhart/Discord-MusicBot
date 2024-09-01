const SlashCommand = require("../../lib/SlashCommand");
const {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} = require("discord.js");
const { findLyrics } = require("llyrics");

const command = new SlashCommand()
	.setName("lyrics")
	.setDescription("Get the lyrics of a song")
	.addStringOption((option) =>
		option
			.setName("song")
			.setDescription("The song to get lyrics for")
			.setRequired(false)
	)
	.setRun(async (client, interaction, options) => {
		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription("🔎 | **Searching...**"),
			],
		});

		let player;
		if (client.manager.Engine) {
			player = client.manager.Engine.players.get(interaction.guild.id);
		} else {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("Red")
						.setDescription("Lavalink node is not connected"),
				],
			});
		}

		const args = interaction.options.getString("song");
		if (!args && !player) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("Red")
						.setDescription("There's nothing playing"),
				],
			});
		}

		let currentTitle = ``;
		const phrasesToRemove = [
			"Full Video",
			"Full Audio",
			"Official Music Video",
			"Lyrics",
			"Lyrical Video",
			"Feat.",
			"Ft.",
			"Official",
			"Audio",
			"Video",
			"HD",
			"4K",
			"Remix",
			"Lyric Video",
			"Lyrics Video",
			"8K",
			"High Quality",
			"Animation Video",
			"\\(Official Video\\. .*\\)",
			"\\(Music Video\\. .*\\)",
			"\\[NCS Release\\]",
			"Extended",
			"DJ Edit",
			"with Lyrics",
			"Lyrics",
			"Karaoke",
			"Instrumental",
			"Live",
			"Acoustic",
			"Cover",
			"\\(feat\\. .*\\)",
		];
		if (!args) {
			currentTitle = player.queue.current.title;
			currentTitle = currentTitle
				.replace(new RegExp(phrasesToRemove.join("|"), "gi"), "")
				.replace(/\s*([\[\(].*?[\]\)])?\s*(\|.*)?\s*(\*.*)?$/, "");
		}
		let query = args ? args : currentTitle;
		let lyricsData;
		try {
			lyricsData = await findLyrics({
				search_engine: { musixmatch: true, youtube: true, genius: false },
				song_title: query,
			});
		} catch {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("Red")
						.setTitle("No lyrics found")
						.setDescription(
							`Here is some tips to get your song lyrics correctly \n
1. Try to add the artist's name in front of the song name.
2. Try to search the lyrics manually by providing the song query using your keyboard.
3. Avoid searching lyrics in languages other than English.`
						),
				],
			});
		}

		function splitText(text, maxChunkLength) {
			const chunks = [];
			for (let i = 0; i < text.length; i += maxChunkLength) {
				chunks.push(text.slice(i, i + maxChunkLength));
			}
			return chunks;
		}

		const lyrics = lyricsData.lyrics;
		const trackName = lyricsData.trackName;
		const trackArtist = lyricsData.trackArtist;
		const artworkUrl = lyricsData.artworkUrl;
		const searchEngine = lyricsData.searchEngine;
		const pageLength = 2000;
		const pages = splitText(lyrics, pageLength);

		let currentPage = 0;

		const embed = new EmbedBuilder()
			.setColor(client.config.embedColor)
			.setTitle(`${trackName} - ${trackArtist}`)
			.setThumbnail(artworkUrl)
			.setDescription(pages[currentPage])
			.setFooter({ text: `Page: ${currentPage + 1}/${pages.length} | Search Engine: ${searchEngine}` });

		const but1 = new ButtonBuilder()
			.setCustomId("prev_interaction")
			.setEmoji("◀️")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(currentPage === 0);

		const but2 = new ButtonBuilder()
			.setCustomId("next_interaction")
			.setEmoji("▶️")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(currentPage === pages.length - 1);

		const but3 = new ButtonBuilder()
			.setEmoji({ id: "948552310504701982" })
			.setCustomId("delete_interaction")
			.setStyle(ButtonStyle.Danger);

		const row = new ActionRowBuilder().addComponents(but1, but2, but3);

		const msg = await interaction.editReply({
			embeds: [embed],
			components: [row],
		});

		const filter = async (button) => {
			if (button.user.id === interaction.user.id) return true;
			else {
				return button.reply({
					ephemeral: true,
					embeds: [
						new EmbedBuilder()
							.setColor(client.config.embedColor)
							.setDescription(
								`${client.e.crossMark} | This interaction button is only for <@${interaction.user.id}>.`
							),
					],
				});
			}
		};

		const collector = msg.createMessageComponentCollector({ filter });

		collector.on("collect", async (i) => {
			if (i.customId === "delete_interaction") {
				await i.deferUpdate();
				i.deleteReply().catch((err) => {
					return;
				});
				msg.delete().catch((err) => {
					return;
				});
			}
			if (i.customId === "next_interaction") {
				currentPage++;
				if (currentPage < pages.length) {
					const newEmbed = new EmbedBuilder()
						.setColor(client.config.embedColor)
						.setTitle(`${trackName} - ${trackArtist}`)
						.setDescription(pages[currentPage])
						.setFooter({
							text: `Page: ${currentPage + 1}/${
								pages.length
							}`,
						});

					const newBut1 = new ButtonBuilder()
						.setCustomId("prev_interaction")
						.setEmoji("◀️")
						.setStyle(ButtonStyle.Primary)
						.setDisabled(currentPage === 0);

					const newBut2 = new ButtonBuilder()
						.setCustomId("next_interaction")
						.setEmoji("▶️")
						.setStyle(ButtonStyle.Primary)
						.setDisabled(currentPage === pages.length - 1);

					const newRow = new ActionRowBuilder().addComponents(
						newBut1,
						newBut2,
						but3
					);

					await i.update({
						embeds: [newEmbed],
						components: [newRow],
					});
				}
			} else if (i.customId === "prev_interaction") {
				currentPage--;
				if (currentPage >= 0) {
					const newEmbed = new EmbedBuilder()
						.setColor(client.config.embedColor)
						.setTitle(`${trackName} - ${trackArtist}`)
						.setDescription(pages[currentPage])
						.setFooter({
							text: `Page: ${currentPage + 1}/${
								pages.length
							}`,
						});

					const newBut1 = new ButtonBuilder()
						.setCustomId("prev_interaction")
						.setEmoji("◀️")
						.setStyle(ButtonStyle.Primary)
						.setDisabled(currentPage === 0);

					const newBut2 = new ButtonBuilder()
						.setCustomId("next_interaction")
						.setEmoji("▶️")
						.setStyle(ButtonStyle.Primary)
						.setDisabled(currentPage === pages.length - 1);

					const newRow = new ActionRowBuilder().addComponents(
						newBut1,
						newBut2,
						but3
					);

					await i.update({
						embeds: [newEmbed],
						components: [newRow],
					});
				}
			}
		});
	});

module.exports = command;
