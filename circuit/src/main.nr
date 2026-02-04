mod resize;

fn main(
    orig: pub [[u32; 64]; 64],
    new: pub [[u32; 32]; 32],
) -> () {
    let _ = resize::resize(orig, new);
}
