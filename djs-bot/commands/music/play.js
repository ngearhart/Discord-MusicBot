const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder } = require("discord.js");
const { joinStageChannelRoutine, addTrack } = require("../../util/player");
const { addQueueEmbed, loadedPlaylistEmbed, redEmbed } = require("../../util/embeds");
const yt = require("youtube-sr").default;
const wait = require('node:timers/promises').setTimeout;

async function testUrlRegex(string) {
	return [
		/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/,
		/^(?:spotify:|https:\/\/[a-z]+\.spotify\.com\/(track\/|user\/(.*)\/playlist\/|playlist\/))(.*)$/,
		/^https?:\/\/(?:www\.)?deezer\.com\/[a-z]+\/(track|album|playlist)\/(\d+)$/,
		/^(?:(https?):\/\/)?(?:(?:www|m)\.)?(soundcloud\.com|snd\.sc)\/(.*)$/,
		/(?:https:\/\/music\.apple\.com\/)(?:.+)?(artist|album|music-video|playlist)\/([\w\-\.]+(\/)+[\w\-\.]+|[^&]+)\/([\w\-\.]+(\/)+[\w\-\.]+|[^&]+)/,
	].some((regex) => {
		return regex.test(string);
	});
}

// This is currently only Erela.js compatible
const command = new SlashCommand()
	.setName("play")
	.setDescription(
		"Searches and plays the requested song \nSupports: \nYoutube, Spotify, Deezer, Apple Music"
	)
	.addStringOption((option) =>
		option
			.setName("query")
			.setDescription("What am I looking for?")
			.setAutocomplete(true)
			.setRequired(true)
	)
	.setAutocompleteOptions(async (input) => {
		if (input.length <= 3) return [];
		if (await testUrlRegex(input)) return [{ name: "URL", value: input }];

		const random = "ytsearch"[Math.floor(Math.random() * "ytsearch".length)];
		const results = await yt.search(input || random, { safeSearch: false, limit: 25 });

		const choices = [];
		for (const video of results) {
			choices.push({ name: video.title, value: video.url });
		}
		return choices;
	})
	.setRun(async (client, interaction, options) => {
		// If it takes more than 3 seconds to respond, Discord errors
		// https://stackoverflow.com/questions/69501014/discordapierror-unknown-interaction-when-trying-to-send-info-about-a-command
		// https://discordjs.guide/slash-commands/response-methods.html#deferred-responses
		await interaction.deferReply({ ephemeral: true });

		let channel = await client.getChannel(client, interaction);
		if (!channel) {
			return;
		}

		// let node = await client.getLavalink(client);

		// if (!node) {
		// 	return interaction.editReply({
		// 		embeds: [
		// 			new EmbedBuilder()
		// 				.setColor("Red")
		// 				.setTitle("Node error!")
		// 				.setDescription(
		// 					`No available nodes to play music on!`
		// 				)
		// 				.setFooter({
		// 					text: "Oops! something went wrong but it's not your fault!",
		// 				}),
		// 		],
		// 	});
		// }
		console.log(interaction.guild.id);
		console.log(channel);
		let player = null;
		const playerRetries = 10;
		for (let i = 0; i < playerRetries; i++) {
			try {
				// await client.getLavalink(client);
				player = client.manager.Engine.createPlayer({
					guildId: interaction.guild.id,
					voiceChannel: channel.id,
					textChannel: interaction.channel.id,
				});
				break;
			} catch (e) {
				client.error(e);
			}
			await wait(1000);
		}
		if (!player) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor("Red")
						.setTitle("Node error!")
						.setDescription(
							`Could not connect to a node!`
						)
						.setFooter({
							text: "Oops! something went wrong but it's not your fault!",
						}),
				],
			});
		}

		if (player.state !== "CONNECTED") {
			player.connect();
		}

		if (channel.type == "GUILD_STAGE_VOICE") {
			joinStageChannelRoutine(interaction.guild.members.me);
		}

		const ret = await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(":mag_right: **Searching...**"),
			],
			fetchReply: true,
		});

		let query = options.getString("query", true);
		const res = await player.search(query, interaction.user).catch((err) => {
			client.error(err);
			return {
				loadType: "LOAD_FAILED",
			};
		});

		const editReplyEmbed = async (embed) => {
			return interaction
				.editReply({
					embeds: [embed],
				})
				.catch(client.warn);
		};

		if (res.loadType === "LOAD_FAILED") {
			if (!player.queue.current) {
				player.destroy();
			}

			await editReplyEmbed(
				redEmbed({
					desc: "There was an error while searching",
				})
			);
		}

		if (res.loadType === "NO_MATCHES") {
			if (!player.queue.current) {
				player.destroy();
			}

			await editReplyEmbed(redEmbed({ desc: "No results were found" }));
		}

		if (res.loadType === "TRACK_LOADED" || res.loadType === "SEARCH_RESULT") {
			player.set("requester", interaction.guild.members.me);
			addTrack(player, res.tracks[0]);

			if (!player.playing && !player.paused && !player.queue.size) {
				player.play();
			}

			if (player.queue.totalSize <= 1)
				player.queue.previous = player.queue.current;

			await editReplyEmbed(
				addQueueEmbed({
					track: res.tracks[0],
					player,
					requesterId: interaction.user.id,
				})
			);
		}

		if (res.loadType === "PLAYLIST_LOADED") {
			player.set("requester", interaction.guild.members.me);
			addTrack(player, res.tracks);

			if (
				!player.playing &&
				!player.paused &&
				player.queue.totalSize === res.tracks.length
			) {
				player.play();
			}

			await editReplyEmbed(loadedPlaylistEmbed({ searchResult: res, query }));
		}

		if (ret) setTimeout(() => ret.delete().catch(client.warn), 20000);
		return ret;
	});

module.exports = command;
