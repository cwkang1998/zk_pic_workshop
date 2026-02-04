// Original EXIF commitment circuit kept for reference.

global MAX_TAGS: u32 = 64;

pub fn main(tag_ids: [u32; MAX_TAGS], tag_count: u32, query_tag: pub u32, commitment: pub Field) {
    assert(tag_count <= MAX_TAGS);

    let mut acc: Field = 0;
    let mut found = false;

    for i in 0..MAX_TAGS {
        let tag = tag_ids[i];
        let active = i < tag_count;

        if active {
            acc = acc * 131 + tag as Field;
            found = found | (tag == query_tag);
        } else {
            assert(tag == 0);
        }
    }

    assert(found);
    assert(acc == commitment);
}

#[test]
fn test_exif_main() {
    let mut tags: [u32; MAX_TAGS] = [0; MAX_TAGS];
    tags[0] = 1;
    tags[1] = 2;
    tags[2] = 3;
    let mut acc: Field = 0;
    for i in 0..3 {
        acc = acc * 131 + tags[i] as Field;
    }

    main(tags, 3, 2, acc);
}
