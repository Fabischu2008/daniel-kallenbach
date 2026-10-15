/**
 * Nur Referenz. In Code Snippets ohne die erste <?php-Zeile einfügen.
 * Holt das HTML von GitHub Pages, legt CSS/JS/Fonts/Bilder auf diesem
 * Webspace ab und liefert sie unter daniel-kallenbach.de aus.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('DK_SITE_MAIL', 'kontakt@daniel-kallenbach.de');
define('DK_SITE_GH', 'https://fabischu2008.github.io/daniel-kallenbach/');
define('DK_SITE_ASSET_VER', '23');

function dk_site_page_map()
{
    return array(
        'ueber-mich'        => 'ueber-mich/',
        'kontakt'           => 'kontakt/',
        'selbstliebe'       => 'selbstliebe/',
        'achtsamkeit'       => 'achtsamkeit/',
        'selbstbewusstsein' => 'selbstbewusstsein/',
        'meditation'        => 'meditation/',
        'impressum'         => 'impressum/',
        'datenschutz'       => 'datenschutz/',
    );
}

function dk_site_asset_dir()
{
    return trailingslashit(WP_CONTENT_DIR . '/uploads/dk-site');
}

function dk_site_asset_url()
{
    return trailingslashit(content_url('uploads/dk-site'));
}

function dk_site_asset_files()
{
    return array(
        'css/style.css',
        'js/color.js',
        'js/energy-field.js',
        'js/site.js',
        'assets/apple-touch-icon.png',
        'assets/daniel-portraet.avif',
        'assets/daniel-portraet.jpg',
        'assets/daniel-portraet.webp',
        'assets/daniel-tor.avif',
        'assets/daniel-tor.jpg',
        'assets/daniel-tor.webp',
        'assets/hero.avif',
        'assets/hero.jpg',
        'assets/hero.webp',
        'assets/logo.png',
        'assets/mark.png',
        'fonts/manrope/OFL.txt',
        'fonts/manrope/manrope-300-latin-ext.woff2',
        'fonts/manrope/manrope-300-latin.woff2',
        'fonts/manrope/manrope-400-latin-ext.woff2',
        'fonts/manrope/manrope-400-latin.woff2',
        'fonts/manrope/manrope-500-latin-ext.woff2',
        'fonts/manrope/manrope-500-latin.woff2',
        'fonts/manrope/manrope-600-latin-ext.woff2',
        'fonts/manrope/manrope-600-latin.woff2',
        'fonts/manrope/manrope-700-latin-ext.woff2',
        'fonts/manrope/manrope-700-latin.woff2',
        'fonts/manrope/manrope-800-latin-ext.woff2',
        'fonts/manrope/manrope-800-latin.woff2',
    );
}

function dk_site_sync_assets()
{
    if (get_option('dk_site_assets_ver') === DK_SITE_ASSET_VER) {
        return;
    }
    $dir = dk_site_asset_dir();
    wp_mkdir_p($dir);
    foreach (dk_site_asset_files() as $rel) {
        $dest = $dir . $rel;
        wp_mkdir_p(dirname($dest));
        $res = wp_remote_get(DK_SITE_GH . $rel, array(
            'timeout'     => 20,
            'redirection' => 3,
            'sslverify'   => true,
        ));
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
            continue;
        }
        $body = wp_remote_retrieve_body($res);
        if ($body === '') {
            continue;
        }
        file_put_contents($dest, $body);
    }
    update_option('dk_site_assets_ver', DK_SITE_ASSET_VER, false);
}

function dk_site_template_key()
{
    if (is_admin() || wp_doing_ajax()) {
        return null;
    }
    if (defined('REST_REQUEST') && REST_REQUEST) {
        return null;
    }
    if (is_feed() || is_preview() || is_embed()) {
        return null;
    }
    if (is_front_page() || is_page('start')) {
        return '';
    }
    if (!is_singular('page')) {
        return null;
    }
    $slug = get_post_field('post_name', get_queried_object_id());
    $map  = dk_site_page_map();
    return isset($map[$slug]) ? $map[$slug] : null;
}

function dk_site_fetch($path)
{
    $url = DK_SITE_GH . ltrim($path, '/');
    $key = 'dk_site_html_v5_' . md5($url);
    $hit = get_transient($key);
    if (is_string($hit) && $hit !== '') {
        return $hit;
    }
    $res = wp_remote_get($url, array(
        'timeout'     => 12,
        'redirection' => 3,
        'sslverify'   => true,
        'headers'     => array('Accept' => 'text/html,application/javascript,*/*'),
    ));
    if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
        return '';
    }
    $body = wp_remote_retrieve_body($res);
    if ($body === '') {
        return '';
    }
    set_transient($key, $body, 15 * MINUTE_IN_SECONDS);
    return $body;
}

function dk_site_local_file($rel)
{
    $path = dk_site_asset_dir() . ltrim($rel, '/');
    if (is_readable($path)) {
        return file_get_contents($path);
    }
    return '';
}

function dk_site_js()
{
    $js = dk_site_local_file('js/site.js');
    if ($js === '') {
        $js = dk_site_fetch('js/site.js?v=22');
    }
    if ($js === '') {
        return '';
    }
    $js = str_replace(
        "formEndpoint: ''",
        "formEndpoint: (window.DK_WP && window.DK_WP.form) || ''",
        $js
    );
    if (strpos($js, 'DK_WP.action') === false) {
        $js = str_replace(
            'body: new FormData(form),',
            'body: (function () { var p = new FormData(form); if (window.DK_WP && window.DK_WP.action) p.append("action", window.DK_WP.action); return p; })(),',
            $js
        );
    }
    return $js;
}

function dk_site_rewrite($html)
{
    $local = dk_site_asset_url();

    $html = preg_replace('#<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>#i', '', $html);

    $html = str_replace(
        array(
            DK_SITE_GH,
            'href="css/',
            'href="../css/',
            'src="js/',
            'src="../js/',
            'src="assets/',
            'src="../assets/',
            'href="assets/',
            'href="../assets/',
            'srcset="assets/',
            'srcset="../assets/',
        ),
        array(
            $local,
            'href="' . $local . 'css/',
            'href="' . $local . 'css/',
            'src="' . $local . 'js/',
            'src="' . $local . 'js/',
            'src="' . $local . 'assets/',
            'src="' . $local . 'assets/',
            'href="' . $local . 'assets/',
            'href="' . $local . 'assets/',
            'srcset="' . $local . 'assets/',
            'srcset="' . $local . 'assets/',
        ),
        $html
    );

    $js = dk_site_js();
    if ($js !== '') {
        $wp = '<script>window.DK_WP=' . wp_json_encode(array(
            'form' => rest_url('dk/v1/kontakt'),
        )) . ';</script>';
        $html = preg_replace('#<script src="[^"]*js/site\.js[^"]*"></script>#', $wp . '<script>' . $js . '</script>', $html);
        if (strpos($html, 'window.DK_WP') === false) {
            $html = str_replace('</body>', $wp . '<script>' . $js . '</script></body>', $html);
        }
    }

    return $html;
}

function dk_site_output()
{
    $key = dk_site_template_key();
    if ($key === null) {
        return;
    }
    dk_site_sync_assets();
    $html = dk_site_fetch($key);
    if ($html === '') {
        return;
    }
    echo dk_site_rewrite($html);
    exit;
}
add_action('template_redirect', 'dk_site_output', 0);

function dk_site_kontakt(WP_REST_Request $req)
{
    if ($req->get_param('website')) {
        return new WP_REST_Response(array('ok' => true), 200);
    }
    $name = sanitize_text_field((string) $req->get_param('name'));
    $mail = sanitize_email((string) $req->get_param('email'));
    $msg  = sanitize_textarea_field((string) $req->get_param('message'));
    if ($name === '' || $mail === '') {
        return new WP_REST_Response(array('ok' => false), 400);
    }
    $sent = wp_mail(
        DK_SITE_MAIL,
        'Kostenloses Gespräch — ' . $name,
        "Name: $name\nE-Mail: $mail\n\n$msg",
        array('Content-Type: text/plain; charset=UTF-8', 'Reply-To: ' . $mail)
    );
    return new WP_REST_Response(array('ok' => (bool) $sent), $sent ? 200 : 500);
}

add_action('rest_api_init', function () {
    register_rest_route('dk/v1', '/kontakt', array(
        'methods'             => 'POST',
        'callback'            => 'dk_site_kontakt',
        'permission_callback' => '__return_true',
    ));
});
