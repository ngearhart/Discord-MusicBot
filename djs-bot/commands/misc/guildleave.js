const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "guildleave",
    category: "misc",
    usage: "/guildleave <id>",
    description: "Leaves a guild specified by the ID.",
    options: [
        {
            name: "id",
            type: 3, // "STRING"
            description: "Enter the guild ID to leave (type `list` for guild IDs)",
            required: true,
        },
    ],
    ownerOnly: true,
    run: async (client, interaction, options) => {
        try {
            const id = interaction.options.getString('id');

            if (id.toLowerCase() === 'list') {
                try {
                    const guildList = client.guilds.cache.map(guild => `${guild.name} | ${guild.id}`).join('\n');
                    return interaction.reply({ content: `Guilds:\n\`${guildList}\``, ephemeral: true });
                } catch (error) {
                    console.error('Error listing guilds:', error);
                    return interaction.reply({ content: `Check console for list of guilds`, ephemeral: true });
                }
            }

            const guild = client.guilds.cache.get(id);
            if (!guild) {
                return interaction.reply({ content: `\`${id}\` is not a valid guild ID`, ephemeral: true });
            }

            await guild.leave();
            return interaction.reply({ content: `Left guild \`${id}\``, ephemeral: true });
        } catch (error) {
            console.error(`There was an error trying to leave guild ${id}:`, error);
            return interaction.reply({ content: `Error leaving guild.`, ephemeral: true });
        }
    },
};
