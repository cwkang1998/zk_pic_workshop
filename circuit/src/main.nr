use poseidon::poseidon2;

global MAX_TAGS: u32 = 32;

pub fn main(
    tag_ids: [Field; MAX_TAGS],
    tag_value_hashes: [Field; MAX_TAGS],
    tag_count: u32,
    secret: Field,
    commitment: pub Field,
) {
    let mut acc: Field = poseidon2::Poseidon2::hash([secret], 1);

    for i in 0..MAX_TAGS {
        let tag = tag_ids[i];
        let active = i < tag_count;

        if active {
            acc = poseidon2::Poseidon2::hash([acc, tag], 2);
            acc = poseidon2::Poseidon2::hash([acc, tag_value_hashes[i]], 2);
        } else {
            assert(tag == 0);
            assert(tag_value_hashes[i] == 0);
        }
    }

    assert(acc == commitment);
}

#[test]
fn test_correct_case() {
    let secret = 123456;
    let mut tag_ids: [Field; MAX_TAGS] = [0; MAX_TAGS];
    let mut tag_values: [Field; MAX_TAGS] = [0; MAX_TAGS];
    tag_ids[0] = 1;
    tag_ids[1] = 2;
    tag_ids[2] = 3;
    tag_values[0] = 11;
    tag_values[1] = 22;
    tag_values[2] = 33;
    let mut acc: Field = poseidon2::Poseidon2::hash([secret], 1);
    for i in 0..3 {
        acc = poseidon2::Poseidon2::hash([acc, tag_ids[i]], 2);
        acc = poseidon2::Poseidon2::hash([acc, tag_values[i]], 2);
    }

    main(tag_ids, tag_values, 3, secret, acc);
}

#[test(should_fail)]
fn test_incorrect_case_should_error() {
    let secret = 123456;
    let mut tag_ids: [Field; MAX_TAGS] = [0; MAX_TAGS];
    let mut tag_values: [Field; MAX_TAGS] = [0; MAX_TAGS];
    tag_ids[0] = 1;
    tag_ids[1] = 2;
    tag_ids[2] = 3;
    tag_values[0] = 11;
    tag_values[1] = 22;
    tag_values[2] = 33;
    let mut acc: Field = poseidon2::Poseidon2::hash([secret], 1);
    for i in 0..3 {
        acc = poseidon2::Poseidon2::hash([acc, tag_ids[i]], 2);
        acc = poseidon2::Poseidon2::hash([acc, tag_values[i]], 2);
    }

    main(tag_ids, tag_values, 3, 45678, acc);
}
