<?php
/**
 * Plugin Name: Will Tool Embed
 * Description: Embed the Will Form Generator app in any page or post via shortcode [will_tool]. Configure the app URL in Settings → Will Tool Embed.
 * Version: 1.0.0
 * Author: Will Tool
 * License: GPL v2 or later
 * Text Domain: will-tool-embed
 */

defined( 'ABSPATH' ) || exit;

const WILL_TOOL_EMBED_OPTION = 'will_tool_embed_url';
const WILL_TOOL_EMBED_HEIGHT_OPTION = 'will_tool_embed_height';

/**
 * Shortcode [will_tool] – outputs an iframe pointing at the configured app URL.
 */
function will_tool_embed_shortcode( $atts ) {
	$url = get_option( WILL_TOOL_EMBED_OPTION, '' );
	if ( empty( $url ) || ! preg_match( '#^https?://#', $url ) ) {
		return '<!-- Will Tool Embed: Set the app URL in Settings → Will Tool Embed -->';
	}

	$height = get_option( WILL_TOOL_EMBED_HEIGHT_OPTION, '800' );
	if ( strpos( $height, 'vh' ) === false && strpos( $height, 'px' ) === false ) {
		$height = $height . 'px';
	}

	$url = esc_url( $url );
	$height = esc_attr( $height );

	return sprintf(
		'<div class="will-tool-embed-fullwidth" style="width: 100vw; position: relative; left: 50%%; right: 50%%; margin-left: -50vw; margin-right: -50vw;"><iframe src="%s" width="100%%" height="%s" style="min-height: 80vh; border: none;" title="Will Form Generator" allow="camera; clipboard-write; fullscreen"></iframe></div>',
		$url,
		$height
	);
}

add_shortcode( 'will_tool', 'will_tool_embed_shortcode' );

/**
 * Settings page: register and render.
 */
function will_tool_embed_settings_menu() {
	add_options_page(
		'Will Tool Embed',
		'Will Tool Embed',
		'manage_options',
		'will-tool-embed',
		'will_tool_embed_settings_page'
	);
}

add_action( 'admin_menu', 'will_tool_embed_settings_menu' );

function will_tool_embed_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	if ( isset( $_POST['will_tool_embed_nonce'] ) && wp_verify_nonce( $_POST['will_tool_embed_nonce'], 'will_tool_embed_save' ) ) {
		$url = isset( $_POST['will_tool_embed_url'] ) ? esc_url_raw( trim( $_POST['will_tool_embed_url'] ) ) : '';
		$height = isset( $_POST['will_tool_embed_height'] ) ? sanitize_text_field( $_POST['will_tool_embed_height'] ) : '800';
		update_option( WILL_TOOL_EMBED_OPTION, $url );
		update_option( WILL_TOOL_EMBED_HEIGHT_OPTION, $height );
		echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
	}

	$url    = get_option( WILL_TOOL_EMBED_OPTION, '' );
	$height = get_option( WILL_TOOL_EMBED_HEIGHT_OPTION, '800' );
	?>
	<div class="wrap">
		<h1>Will Tool Embed</h1>
		<p>Embed the Will Form Generator on your site using the shortcode <code>[will_tool]</code>. In Elementor, add a <strong>Shortcode</strong> widget and enter <code>[will_tool]</code>.</p>
		<form method="post" action="">
			<?php wp_nonce_field( 'will_tool_embed_save', 'will_tool_embed_nonce' ); ?>
			<table class="form-table">
				<tr>
					<th scope="row"><label for="will_tool_embed_url">Will Tool URL</label></th>
					<td>
						<input type="url" name="will_tool_embed_url" id="will_tool_embed_url" value="<?php echo esc_attr( $url ); ?>" class="regular-text" placeholder="https://will-tool.vercel.app" />
						<p class="description">Full URL where the Will Tool app is hosted (e.g. Vercel or your domain).</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="will_tool_embed_height">Iframe height</label></th>
					<td>
						<input type="text" name="will_tool_embed_height" id="will_tool_embed_height" value="<?php echo esc_attr( $height ); ?>" placeholder="800 or 80vh" />
						<p class="description">e.g. <code>800</code>, <code>80vh</code>, or <code>900px</code>.</p>
					</td>
				</tr>
			</table>
			<?php submit_button( 'Save settings' ); ?>
		</form>
	</div>
	<?php
}
